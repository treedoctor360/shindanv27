// アプリ全体で共有する状態（Zustand）
// 実データの永続化は Dexie（src/db/db.js）が担い、ここはその「今の姿」を
// メモリ上に持って各コンポーネントへ配る役割。

import { create } from 'zustand';
import { db, saveRecordWithPhotos, deleteRecordWithPhotos, getSetting, setSetting } from '../db/db.js';
import { autoPull } from '../features/gas/gasSync.js';

export const useRecordStore = create((set, get) => ({
  // ---- 状態 ----
  records: [],           // 診断record一覧（写真は含まない）
  projects: [],          // 案件（調査プロジェクト）一覧
  activeProjectId: '',   // 現在選択中の案件ID（新規record に付与）
  loaded: false,         // Dexie からの初回読込が済んだか
  editingId: null,       // 編集中の record.id（null = 新規）
  syncMessage: '',       // クラウド同期の状態表示（''なら非表示）
  settings: {
    gasUrl: '',          // GAS（Google Apps Script）同期先URL
    inspector: '',       // 既定の調査者名
    lastBackupAt: null   // 最終バックアップ（JSON書き出し or GAS同期）日時
  },

  // ---- 初期化: Dexie から読み込み、クラウドから自動取り込み ----
  load: async () => {
    const records = await db.records.toArray();
    const projects = await db.projects.toArray();
    const settings = {
      gasUrl: await getSetting('gasUrl', ''),
      inspector: await getSetting('inspector', ''),
      lastBackupAt: await getSetting('lastBackupAt', null)
    };
    const activeProjectId = await getSetting('activeProjectId', '');
    set({ records, projects, activeProjectId, settings, loaded: true });

    // 起動時の自動取り込み（クラウドが共有マスタ）。
    // 画面表示は止めない。オフラインや未設定なら黙って諦める。
    if (settings.gasUrl && navigator.onLine) {
      set({ syncMessage: '☁️ クラウドから取り込み中…' });
      try {
        const { applied, total } = await autoPull(settings.gasUrl);
        await get().reload();
        set({
          syncMessage:
            applied > 0 ? `☁️ クラウドから ${applied} 件を取り込みました` : `☁️ クラウドと同期済み（${total} 件）`
        });
      } catch {
        set({ syncMessage: '⚠️ クラウド取り込みに失敗（オフライン?）。ローカルのデータで動作中' });
      }
      // 数秒後にメッセージを消す
      setTimeout(() => set({ syncMessage: '' }), 6000);
    }
  },

  // ---- 案件（プロジェクト） ----
  addProject: async (name) => {
    const trimmed = (name ?? '').trim();
    if (!trimmed) return null;
    const project = { id: `proj-${Date.now()}`, name: trimmed, createdAt: new Date().toISOString() };
    await db.projects.put(project);
    await setSetting('activeProjectId', project.id);
    set({ projects: [...get().projects, project], activeProjectId: project.id });
    return project;
  },

  deleteProject: async (id) => {
    await db.projects.delete(id);
    const next = get().activeProjectId === id ? '' : get().activeProjectId;
    if (next !== get().activeProjectId) await setSetting('activeProjectId', next);
    set({ projects: get().projects.filter((p) => p.id !== id), activeProjectId: next });
  },

  setActiveProject: async (id) => {
    await setSetting('activeProjectId', id);
    set({ activeProjectId: id });
  },

  // ---- record CRUD ----
  saveRecord: async (record, images) => {
    // 更新日時は保存のたびに刻む（クラウド同期の競合解決に使う）
    const toSave = { ...record, updatedAt: new Date().toISOString(), _sentToGAS: false };
    await saveRecordWithPhotos(toSave, images);
    const records = await db.records.toArray();
    set({ records });
  },

  deleteRecord: async (id) => {
    await deleteRecordWithPhotos(id);
    set({ records: get().records.filter((r) => r.id !== id) });
  },

  setEditingId: (id) => set({ editingId: id }),

  // 取り込み・全消去などDexieを直接更新した後に一覧を再読込する
  reload: async () => {
    const records = await db.records.toArray();
    const projects = await db.projects.toArray();
    set({ records, projects });
  },

  // ---- 設定 ----
  updateSetting: async (key, value) => {
    await setSetting(key, value);
    set({ settings: { ...get().settings, [key]: value } });
  },

  markBackedUp: async () => {
    const now = new Date().toISOString();
    await setSetting('lastBackupAt', now);
    set({ settings: { ...get().settings, lastBackupAt: now } });
  }
}));

/** 最終バックアップからの経過日数（未実施なら null） */
export function daysSinceBackup(lastBackupAt) {
  if (!lastBackupAt) return null;
  const ms = Date.now() - new Date(lastBackupAt).getTime();
  if (Number.isNaN(ms)) return null;
  return Math.floor(ms / (24 * 60 * 60 * 1000));
}
