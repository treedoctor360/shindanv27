// 記録一覧: 案件フィルタ・検索・編集・削除・各種出力・クラウド共有/読込
import { useMemo, useState } from 'react';
import { useRecordStore } from '../../store/useRecordStore.js';
import { exportRecordsToExcel } from '../../features/excel/exportExcel.js';
import { exportRecordsToCsv } from '../../features/csv/exportCsv.js';
import { exportGpx } from '../../features/gpx/exportGpx.js';
import { exportPhotoZip } from '../../features/zip/exportPhotoZip.js';
import { buildMailBody, openMailApp } from '../../features/mail/mailShare.js';
import { pushProject, pullProject, selectUnsent } from '../../features/gas/gasSync.js';
import ButtonGroup from '../InspectForm/ButtonGroup.jsx';

const GRADE_ORDER = { D: 0, C: 1, B: 2, A: 3 };
// GPX出力のモード（v26.8 と同じ並び: 全件 / A / B / C / D / 表示中のみ）
const GPX_MODES = [
  { key: 'all', label: '全件' },
  { key: 'A', label: '🟢 A' },
  { key: 'B', label: '🟡 B' },
  { key: 'C', label: '🟠 C' },
  { key: 'D', label: '🔴 D' },
  { key: 'filtered', label: '🔍 表示中のみ' }
];

export default function RecordList({ onEdit }) {
  const { records, projects, deleteRecord, setEditingId, settings, markBackedUp, reload } =
    useRecordStore();
  const [query, setQuery] = useState('');
  const [gradeFilter, setGradeFilter] = useState('');
  const [projectFilter, setProjectFilter] = useState(''); // '' = 全案件
  const [busy, setBusy] = useState('');
  const [zipProgress, setZipProgress] = useState(null); // {done, total} | null
  const [mailOpen, setMailOpen] = useState(false);
  const [mailTo, setMailTo] = useState('');
  const [mailSubject, setMailSubject] = useState(
    `樹木点検データ（${new Date().toISOString().slice(0, 10)}）`
  );
  const [mailSummary, setMailSummary] = useState(true);

  const filtered = useMemo(() => {
    let list = records;
    if (projectFilter) {
      list = list.filter((r) => r.projectId === projectFilter);
    }
    if (query) {
      const q = query.toLowerCase();
      list = list.filter((r) =>
        [r.treeNo, r.species, r.location, r.nickname, r.inspector]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(q))
      );
    }
    if (gradeFilter) {
      list = list.filter((r) => r.overall === gradeFilter);
    }
    // 危険度の高い順 → 調査日の新しい順
    return [...list].sort((a, b) => {
      const g = (GRADE_ORDER[a.overall] ?? 9) - (GRADE_ORDER[b.overall] ?? 9);
      if (g !== 0) return g;
      return (b.surveyDate ?? '').localeCompare(a.surveyDate ?? '');
    });
  }, [records, query, gradeFilter, projectFilter]);

  const selectedProject = projects.find((p) => p.id === projectFilter);
  const projectName = (id) => projects.find((p) => p.id === id)?.name ?? '';

  const handleEdit = (id) => {
    setEditingId(id);
    onEdit?.();
  };

  const handleDelete = async (r) => {
    if (window.confirm(`樹木番号 ${r.treeNo}（${r.surveyDate}）の記録を削除しますか？`)) {
      await deleteRecord(r.id);
    }
  };

  const handleExcel = () => {
    exportRecordsToExcel(filtered);
  };

  // CSV出力（表示中の一覧を出力）
  const handleCsv = () => {
    const n = exportRecordsToCsv(filtered);
    if (n === 0) alert('出力する記録がありません');
  };

  // GPX出力（全件 / 判定別 / 表示中のみ）
  const handleGpx = (mode) => {
    let targets;
    let label;
    if (mode === 'all') {
      targets = records;
      label = '全件';
    } else if (mode === 'filtered') {
      targets = filtered;
      label = '表示中';
    } else {
      targets = records.filter((r) => r.overall === mode);
      label = `判定${mode}`;
    }
    const n = exportGpx(targets, label);
    if (n === 0) {
      alert('位置情報のある対象記録がありません。\n（緯度・経度が入力されたデータが必要です）');
    } else {
      alert(`✅ GPXファイルを出力しました（${n}件 / ${label}）\n位置情報のない記録は除外されています。`);
    }
  };

  // 写真ZIP出力（表示中の一覧の写真をまとめる）
  const handlePhotoZip = async () => {
    setBusy('zip');
    setZipProgress({ done: 0, total: 0 });
    try {
      const res = await exportPhotoZip(filtered, {
        folderSplit: true,
        onProgress: (done, total) => setZipProgress({ done, total })
      });
      if (res.photos === 0) alert('写真が保存されている記録がありません');
      else alert(`✅ 写真ZIPを出力しました（${res.records}本 / ${res.photos}枚）`);
    } catch (err) {
      alert(`ZIP出力に失敗しました: ${err.message}`);
    } finally {
      setBusy('');
      setZipProgress(null);
    }
  };

  // メール送信（mailto: でメールアプリを開く）
  const handleMailSend = () => {
    if (!mailTo.trim()) {
      alert('送信先メールアドレスを入力してください');
      return;
    }
    openMailApp(mailTo.trim(), mailSubject, buildMailBody(filtered, { includeSummary: mailSummary }));
    setMailOpen(false);
  };

  // ☁️ 共有: 表示中の案件（全案件なら案件ごとにまとめて）をクラウドへ
  const handlePush = async () => {
    if (!settings.gasUrl) {
      alert('設定タブで GAS URL を登録してください');
      return;
    }
    setBusy('push');
    try {
      let sent = 0;
      let photoCount = 0;
      if (projectFilter) {
        const target = records.filter((r) => r.projectId === projectFilter);
        const res = await pushProject(settings.gasUrl, selectedProject?.name ?? '', target);
        sent = res.sent;
        photoCount = res.photos;
      } else {
        // 全案件: 案件ごとにシートを分けて送る
        const groups = new Map();
        for (const r of records) {
          const key = r.projectId ?? '';
          if (!groups.has(key)) groups.set(key, []);
          groups.get(key).push(r);
        }
        for (const [pid, group] of groups) {
          const res = await pushProject(settings.gasUrl, projectName(pid), group);
          sent += res.sent;
          photoCount += res.photos;
        }
      }
      await reload();
      await markBackedUp();
      alert(`クラウドへ共有しました: 記録 ${sent} 件・写真 ${photoCount} 件分`);
    } catch (err) {
      alert(err.message);
    } finally {
      setBusy('');
    }
  };

  // ⬇️ 読込: クラウドから取り込む（案件指定なら置き換え・全案件ならマージ）
  const handlePull = async () => {
    if (!settings.gasUrl) {
      alert('設定タブで GAS URL を登録してください');
      return;
    }
    const name = selectedProject?.name ?? '';
    if (projectFilter) {
      const unsent = selectUnsent(records.filter((r) => r.projectId === projectFilter));
      const warn =
        unsent.length > 0
          ? `\n※ 未共有の変更 ${unsent.length} 件はクラウドの内容で上書きされます。`
          : '';
      if (!window.confirm(`案件「${name}」をクラウドの内容に置き換えます。よろしいですか？${warn}`)) {
        return;
      }
    }
    setBusy('pull');
    try {
      const res = await pullProject(settings.gasUrl, name, projectFilter ? 'replace' : 'merge');
      await reload();
      alert(`クラウドから読み込みました: 記録 ${res.records} 件・写真 ${res.photos} 枚`);
    } catch (err) {
      alert(err.message);
    } finally {
      setBusy('');
    }
  };

  return (
    <div className="record-list">
      {/* 案件フィルタ */}
      {projects.length > 0 && (
        <div className="project-bar">
          <span className="project-bar-label">案件</span>
          <ButtonGroup
            options={[
              { value: '', label: '全案件' },
              ...projects.map((p) => ({ value: p.id, label: p.name }))
            ]}
            value={projectFilter}
            onChange={(v) => setProjectFilter(v || '')}
          />
        </div>
      )}

      <div className="list-toolbar">
        <input
          placeholder="樹木番号・樹種・場所で検索"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <select value={gradeFilter} onChange={(e) => setGradeFilter(e.target.value)}>
          <option value="">全判定</option>
          <option value="D">Dのみ</option>
          <option value="C">Cのみ</option>
          <option value="B">Bのみ</option>
          <option value="A">Aのみ</option>
        </select>
        <button type="button" onClick={handlePush} disabled={busy !== ''}>
          {busy === 'push' ? '共有中…' : `☁️ ${selectedProject ? `「${selectedProject.name}」を共有` : '全件を共有'}`}
        </button>
        <button type="button" onClick={handlePull} disabled={busy !== ''}>
          {busy === 'pull' ? '読込中…' : `⬇️ ${selectedProject ? `「${selectedProject.name}」を読込` : '全件を読込'}`}
        </button>
      </div>

      {/* ---- 出力・エクスポート（v26.8互換） ---- */}
      <fieldset className="export-panel">
        <legend>出力・エクスポート</legend>
        <div className="check-row">
          <button type="button" onClick={handleExcel} disabled={filtered.length === 0}>
            📄 一覧表Excel
          </button>
          <button type="button" onClick={handleCsv} disabled={filtered.length === 0}>
            🗒 CSV
          </button>
          <button type="button" onClick={handlePhotoZip} disabled={busy !== '' || filtered.length === 0}>
            {busy === 'zip' ? 'ZIP作成中…' : '🖼️ 写真ZIP'}
          </button>
          <button type="button" onClick={() => window.print()} disabled={filtered.length === 0}>
            🖨 印刷
          </button>
          <button type="button" onClick={() => setMailOpen(!mailOpen)}>
            ✉️ メール送信
          </button>
        </div>
        {zipProgress && zipProgress.total > 0 && (
          <p className="hint">
            写真を処理中… {zipProgress.done} / {zipProgress.total} 枚
          </p>
        )}
        <div className="gpx-row">
          <span className="hint">📍 GPX出力（地図アプリ用）:</span>
          {GPX_MODES.map((m) => (
            <button key={m.key} type="button" onClick={() => handleGpx(m.key)}>
              {m.label}
            </button>
          ))}
        </div>
        {mailOpen && (
          <div className="mail-panel">
            <label className="field">
              <span>送信先メールアドレス</span>
              <input
                type="email"
                value={mailTo}
                placeholder="example@example.com"
                onChange={(e) => setMailTo(e.target.value)}
              />
            </label>
            <label className="field">
              <span>件名</span>
              <input value={mailSubject} onChange={(e) => setMailSubject(e.target.value)} />
            </label>
            <label className="check">
              <input
                type="checkbox"
                checked={mailSummary}
                onChange={(e) => setMailSummary(e.target.checked)}
              />
              本文に記録の概要を含める（表示中の {filtered.length} 件）
            </label>
            <p className="hint">
              メールアプリが開きます。JSON/CSVを添付したい場合は先にダウンロードして手動添付してください。
            </p>
            <button type="button" className="primary" onClick={handleMailSend}>
              ✉️ メールアプリを開く
            </button>
          </div>
        )}
      </fieldset>

      <p className="hint">
        {filtered.length} / {records.length} 件
        {records.some((r) => !r._sentToGAS) &&
          `（未共有 ${records.filter((r) => !r._sentToGAS).length} 件）`}
      </p>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>判定</th>
              <th>樹木番号</th>
              <th>樹種</th>
              <th>調査日</th>
              <th>活力度平均</th>
              <th>場所</th>
              <th>共有</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.id}>
                <td>
                  <span className={`grade-badge grade-${r.overall ?? 'none'}`}>
                    {r.overall ?? '—'}
                  </span>
                </td>
                <td>{r.treeNo}</td>
                <td>{r.species || '—'}</td>
                <td>{r.surveyDate}</td>
                <td>{r.avg != null ? Number(r.avg).toFixed(2) : '—'}</td>
                <td>{r.location || '—'}</td>
                <td>{r._sentToGAS ? '✓' : ''}</td>
                <td className="row-actions">
                  <button type="button" onClick={() => handleEdit(r.id)}>
                    編集
                  </button>
                  <button type="button" className="danger" onClick={() => handleDelete(r)}>
                    削除
                  </button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={8} className="empty">
                  記録がありません
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
