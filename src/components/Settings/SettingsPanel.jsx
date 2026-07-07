// 設定・バックアップ・旧データ取込
// - GAS接続設定 / 既定調査者
// - JSONバックアップ書き出し（写真込み）
// - JSON取り込み: 追記マージ（id一致で更新・未知idは追加）／全上書き（確認あり）
import { useRef, useState } from 'react';
import { useRecordStore } from '../../store/useRecordStore.js';
import { db, exportAll } from '../../db/db.js';
import { importBackup } from '../../features/import/importLegacy.js';

export default function SettingsPanel() {
  const {
    settings,
    updateSetting,
    markBackedUp,
    reload,
    records,
    projects,
    activeProjectId,
    addProject,
    deleteProject,
    setActiveProject
  } = useRecordStore();
  const fileRef = useRef(null);
  const [mode, setMode] = useState('merge');
  const [busy, setBusy] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');

  // 案件（プロジェクト）の新規登録
  const handleAddProject = async () => {
    const created = await addProject(newProjectName);
    if (created) setNewProjectName('');
    else alert('案件名を入力してください');
  };

  const handleDeleteProject = async (p) => {
    const count = records.filter((r) => r.projectId === p.id).length;
    const msg =
      count > 0
        ? `案件「${p.name}」を削除しますか？\nこの案件の記録 ${count} 件は残りますが、案件の紐づけは外れます。`
        : `案件「${p.name}」を削除しますか？`;
    if (window.confirm(msg)) await deleteProject(p.id);
  };

  // JSONバックアップ書き出し
  const handleExport = async () => {
    setBusy(true);
    try {
      const data = await exportAll();
      const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `樹木診断バックアップ_${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      await markBackedUp();
    } finally {
      setBusy(false);
    }
  };

  // 無効記録の掃除: 樹木番号が無く評価も写真も無い「空の記録」を削除する
  const handleRemoveInvalid = async () => {
    const invalid = [];
    for (const r of records) {
      if (r.treeNo) continue;
      const hasScores = Object.values(r.scores ?? {}).some((v) => v !== '' && v != null);
      const hasHealth = Object.values(r.health ?? {}).some((v) => v);
      const photoRow = await db.photos.get(r.id);
      const hasPhotos = (photoRow?.images ?? []).length > 0;
      if (!hasScores && !hasHealth && !hasPhotos) invalid.push(r);
    }
    if (invalid.length === 0) {
      alert('無効な記録はありません');
      return;
    }
    if (!window.confirm(`樹木番号も評価も写真も無い記録 ${invalid.length} 件を削除しますか？`)) return;
    await db.transaction('rw', db.records, db.photos, async () => {
      for (const r of invalid) {
        await db.records.delete(r.id);
        await db.photos.delete(r.id);
      }
    });
    await reload();
    alert(`${invalid.length} 件を削除しました`);
  };

  // JSON取り込み（v26書き出し / v27バックアップ両対応）
  const handleImportFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      if (mode === 'overwrite') {
        const ok = window.confirm(
          `【全上書き】現在の ${records.length} 件の記録をすべて消去し、` +
            'ファイルの内容で置き換えます。よろしいですか？\n' +
            '（元に戻せません。先にバックアップの書き出しを推奨します）'
        );
        if (!ok) return;
      }
      setBusy(true);
      const text = await file.text();
      const result = await importBackup(text, mode);
      await reload();
      alert(
        `取り込み完了: ${result.total} 件（追加 ${result.added} / 更新 ${result.updated}）`
      );
    } catch (err) {
      alert(`取り込みに失敗しました: ${err.message}`);
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <div className="settings-panel">
      <fieldset>
        <legend>案件（調査プロジェクト）</legend>
        <p className="hint">
          案件名を登録すると、点検入力タブの上部でボタン選択でき、記録に紐づきます。
        </p>
        <div className="gps-row">
          <input
            value={newProjectName}
            placeholder="例: 令和8年度 街路樹点検"
            onChange={(e) => setNewProjectName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleAddProject();
            }}
          />
          <button type="button" onClick={handleAddProject}>
            ＋ 登録
          </button>
        </div>
        {projects.length > 0 && (
          <ul className="project-list">
            {projects.map((p) => {
              const count = records.filter((r) => r.projectId === p.id).length;
              const active = p.id === activeProjectId;
              return (
                <li key={p.id} className={active ? 'active' : ''}>
                  <button
                    type="button"
                    className={active ? 'btn-choice selected' : 'btn-choice'}
                    onClick={() => setActiveProject(active ? '' : p.id)}
                  >
                    {active ? '✅ ' : ''}
                    {p.name}
                  </button>
                  <span className="hint">記録 {count} 件</span>
                  <button type="button" className="danger" onClick={() => handleDeleteProject(p)}>
                    削除
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </fieldset>

      <fieldset>
        <legend>クラウド共有（スプレッドシート＋Drive）</legend>
        <p className="hint">
          スプレッドシート（記録）と Drive（写真）を共有マスタとして使います。
          URLを設定すると、アプリを開くたびに自動でクラウドから記録を取り込み、
          記録一覧の「☁️ 共有」「⬇️ 読込」で案件ごとにやり取りできます。
          GAS側の導入手順はリポジトリの <code>gas/Code.gs</code> 冒頭を参照してください。
        </p>
        <label className="field">
          <span>GAS WebアプリURL</span>
          <input
            value={settings.gasUrl}
            placeholder="https://script.google.com/macros/s/…/exec"
            onChange={(e) => updateSetting('gasUrl', e.target.value)}
          />
        </label>
      </fieldset>

      <fieldset>
        <legend>入力の既定値</legend>
        <label className="field">
          <span>調査者名（新規記録の初期値）</span>
          <input
            value={settings.inspector}
            onChange={(e) => updateSetting('inspector', e.target.value)}
          />
        </label>
      </fieldset>

      <fieldset>
        <legend>バックアップ</legend>
        <p className="hint">
          記録 {records.length} 件。最終バックアップ:{' '}
          {settings.lastBackupAt
            ? new Date(settings.lastBackupAt).toLocaleString('ja-JP')
            : '未実施'}
        </p>
        <button type="button" onClick={handleExport} disabled={busy}>
          ⬇️ JSON書き出し（写真込み）
        </button>
      </fieldset>

      <fieldset>
        <legend>データ取り込み（v26書き出しJSON / v27バックアップ）</legend>
        <div className="check-row">
          <label className="check">
            <input
              type="radio"
              name="import-mode"
              checked={mode === 'merge'}
              onChange={() => setMode('merge')}
            />
            追記マージ（id一致は更新・未知idは追加）
          </label>
          <label className="check">
            <input
              type="radio"
              name="import-mode"
              checked={mode === 'overwrite'}
              onChange={() => setMode('overwrite')}
            />
            全上書き（既存を消去）
          </label>
        </div>
        <input ref={fileRef} type="file" accept=".json,application/json" onChange={handleImportFile} disabled={busy} />
        <p className="hint">
          現行版（v26.x）で「JSON書き出し」したファイルをそのまま取り込めます。
          写真は自動的に写真テーブルへ分離され、判定値は取り込み時に再計算されます。
        </p>
      </fieldset>

      <fieldset>
        <legend>メンテナンス</legend>
        <button type="button" className="danger" onClick={handleRemoveInvalid} disabled={busy}>
          🧹 無効記録を削除
        </button>
        <p className="hint">樹木番号・評価・写真がすべて空の記録を削除します（確認あり）。</p>
      </fieldset>
    </div>
  );
}
