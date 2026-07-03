// 記録一覧: 検索・編集・削除・Excel出力・GAS同期
import { useMemo, useState } from 'react';
import { useRecordStore } from '../../store/useRecordStore.js';
import { exportRecordsToExcel } from '../../features/excel/exportExcel.js';
import { syncToGAS, selectUnsent } from '../../features/gas/gasSync.js';

const GRADE_ORDER = { D: 0, C: 1, B: 2, A: 3 };

export default function RecordList({ onEdit }) {
  const { records, deleteRecord, setEditingId, settings, markBackedUp } = useRecordStore();
  const [query, setQuery] = useState('');
  const [gradeFilter, setGradeFilter] = useState('');
  const [syncing, setSyncing] = useState(false);

  const filtered = useMemo(() => {
    let list = records;
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
  }, [records, query, gradeFilter]);

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

  const handleGasSync = async () => {
    const unsent = selectUnsent(records);
    if (unsent.length === 0) {
      alert('未送信の記録はありません');
      return;
    }
    if (!settings.gasUrl) {
      alert('設定タブで GAS URL を登録してください');
      return;
    }
    setSyncing(true);
    try {
      const { sent } = await syncToGAS(settings.gasUrl, unsent);
      await useRecordStore.getState().reload();
      await markBackedUp();
      alert(`${sent} 件を送信しました`);
    } catch (err) {
      alert(err.message);
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="record-list">
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
        <button type="button" onClick={handleExcel} disabled={filtered.length === 0}>
          📄 Excel出力
        </button>
        <button type="button" onClick={handleGasSync} disabled={syncing}>
          {syncing ? '送信中…' : '☁️ GAS同期'}
        </button>
      </div>

      <p className="hint">
        {filtered.length} / {records.length} 件
        {records.some((r) => !r._sentToGAS) &&
          `（未送信 ${records.filter((r) => !r._sentToGAS).length} 件）`}
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
              <th>GAS</th>
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
