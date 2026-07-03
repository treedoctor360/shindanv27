// アプリ全体で共有する状態（Zustand）
// 実データの永続化は Dexie（src/db/db.js）が担い、ここはその「今の姿」を
// メモリ上に持って各コンポーネントへ配る役割。

import { create } from 'zustand';
import { db, saveRecordWithPhotos, deleteRecordWithPhotos, getSetting, setSetting } from '../db/db.js';

export const useRecordStore = create((set, get) => ({
  // ---- 状態 ----
  records: [],           // 診断record一覧（写真は含まない）
  loaded: false,         // Dexie からの初回読込が済んだか
  editingId: null,       // 編集中の record.id（null = 新規）
  settings: {
    gasUrl: '',          // GAS（Google Apps Script）同期先URL
    inspector: '',       // 既定の調査者名
    lastBackupAt: null   // 最終バックアップ（JSON書き出し or GAS同期）日時
  },

  // ---- 初期化: Dexie から読み込む ----
  load: async () => {
    const records = await db.records.toArray();
    const settings = {
      gasUrl: await getSetting('gasUrl', ''),
      inspector: await getSetting('inspector', ''),
      lastBackupAt: await getSetting('lastBackupAt', null)
    };
    set({ records, settings, loaded: true });
  },

  // ---- record CRUD ----
  saveRecord: async (record, images) => {
    await saveRecordWithPhotos(record, images);
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
    set({ records });
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
