// 設定・バックアップ・旧データ取込
// - GAS接続設定 / 既定調査者
// - JSONバックアップ書き出し（写真込み）
// - JSON取り込み: 追記マージ（id一致で更新・未知idは追加）／全上書き（確認あり）
import { useRef, useState } from 'react';
import { useRecordStore } from '../../store/useRecordStore.js';
import { exportAll } from '../../db/db.js';
import { importBackup } from '../../features/import/importLegacy.js';

export default function SettingsPanel() {
  const { settings, updateSetting, markBackedUp, reload, records } = useRecordStore();
  const fileRef = useRef(null);
  const [mode, setMode] = useState('merge');
  const [busy, setBusy] = useState(false);

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
        <legend>GAS同期（スプレッドシート）</legend>
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
    </div>
  );
}
