// データ層: Dexie(IndexedDB) 定義
//
// 保存の一元化（CLAUDE.md §2-1）:
//   診断記録・通常写真・位置写真はすべてここ（IndexedDB）に集約する。
//   localStorage は「設定値（GAS接続情報・写真圧縮設定）」だけに限定
//   → 本アプリでは設定値も settings テーブルに置き、localStorage は使わない。

import Dexie from 'dexie';

export const db = new Dexie('treeShindanV27');

db.version(1).stores({
  // 診断本体（写真は持たない）。カンマ区切りはインデックス列の指定。
  records: 'id, treeNo, surveyDate, projectId, overall',
  // 通常写真＋位置写真: { recordId, images: string[] (dataURL) }
  photos: 'recordId',
  // 調査プロジェクト: { id, name, createdAt }
  projects: 'id',
  // 単一値設定: { key, value }（GAS設定・圧縮設定・最終バックアップ日時など）
  settings: 'key'
});

// ---- settings ヘルパー ----

export async function getSetting(key, defaultValue = null) {
  const row = await db.settings.get(key);
  return row === undefined ? defaultValue : row.value;
}

export async function setSetting(key, value) {
  await db.settings.put({ key, value });
}

// ---- records / photos ヘルパー ----

/** record と写真をまとめて保存する（写真は別テーブルに分離） */
export async function saveRecordWithPhotos(record, images) {
  await db.transaction('rw', db.records, db.photos, async () => {
    await db.records.put(record);
    if (Array.isArray(images)) {
      if (images.length > 0) {
        await db.photos.put({ recordId: record.id, images });
      } else {
        await db.photos.delete(record.id);
      }
    }
  });
}

/** record と写真をまとめて削除する */
export async function deleteRecordWithPhotos(recordId) {
  await db.transaction('rw', db.records, db.photos, async () => {
    await db.records.delete(recordId);
    await db.photos.delete(recordId);
  });
}

/** 全記録の JSON バックアップ用データを組み立てる（写真込み） */
export async function exportAll() {
  const [records, photos, projects] = await Promise.all([
    db.records.toArray(),
    db.photos.toArray(),
    db.projects.toArray()
  ]);
  return {
    app: 'tree-shindan',
    version: 27,
    exportedAt: new Date().toISOString(),
    records,
    photos,
    projects
  };
}
