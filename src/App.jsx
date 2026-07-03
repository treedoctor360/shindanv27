// アプリ本体: タブ切替＋バックアップ促進バナー＋フッター
import { useEffect, useState } from 'react';
import { useRecordStore, daysSinceBackup } from './store/useRecordStore.js';
import InspectForm from './components/InspectForm/InspectForm.jsx';
import RecordList from './components/RecordList/RecordList.jsx';
import MapView from './components/MapView/MapView.jsx';
import SettingsPanel from './components/Settings/SettingsPanel.jsx';

const TABS = [
  { id: 'inspect', label: '点検入力' },
  { id: 'list', label: '記録一覧' },
  { id: 'map', label: '地図' },
  { id: 'settings', label: '設定' }
];

// この日数を超えてバックアップが無いと促しを表示する
const BACKUP_NUDGE_DAYS = 7;

export default function App() {
  const { load, loaded, records, settings, syncMessage } = useRecordStore();
  const [tab, setTab] = useState('inspect');

  useEffect(() => {
    load();
  }, [load]);

  if (!loaded) {
    return <div className="loading">読み込み中…</div>;
  }

  const days = daysSinceBackup(settings.lastBackupAt);
  const showBackupNudge =
    records.length > 0 && (days === null || days >= BACKUP_NUDGE_DAYS);

  return (
    <div className="app">
      <header className="app-header">
        <h1>樹木診断・点検システム v27</h1>
        <nav className="tabs">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              className={tab === t.id ? 'tab active' : 'tab'}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </header>

      {syncMessage && <div className="banner banner-sync">{syncMessage}</div>}

      {showBackupNudge && (
        <div className="banner banner-backup">
          💾{' '}
          {days === null
            ? 'まだバックアップがありません。'
            : `最終バックアップから ${days} 日経過しています。`}{' '}
          設定タブから JSON書き出し または GAS同期 を実行してください。
          <button type="button" onClick={() => setTab('settings')}>
            設定を開く
          </button>
        </div>
      )}

      <main className="app-main">
        {tab === 'inspect' && <InspectForm onSaved={() => setTab('list')} />}
        {tab === 'list' && <RecordList onEdit={() => setTab('inspect')} />}
        {tab === 'map' && <MapView onEdit={() => setTab('inspect')} />}
        {tab === 'settings' && <SettingsPanel />}
      </main>

      <footer className="app-footer">© 2026 Koh Kitsukawa. All rights reserved.</footer>
    </div>
  );
}
