// 旧データ（v26.x の JSON 書き出し）の取り込み
//
// 使い方: 現行版で「JSON書き出し」→ 本v27の設定画面で取り込む。
// v26 の record は写真を本体に含む（photos / locationPhoto 等）ため、
// 取り込み時に photos テーブルへ分離する。
//
// 【マージ】CLAUDE.md §2-4: id 一致で更新、未知の id は追加。
// 全上書きモードは呼び出し側で確認ダイアログを出してから実行すること。

import { db } from '../../db/db.js';
import { evaluateRecord } from '../../logic/diagnosis.js';
import { DECLINE_ITEM_IDS } from '../../data/declineItems.js';

// v26 と v27 で項目キーが異なる場合の対応表。
// 旧データの実サンプルを確認し、必要ならここに旧キー→新キーを追記する。
// 例: { juke: 'd01', edaShincho: 'd02', ... }
export const SCORE_KEY_MAP = {};
export const HEALTH_KEY_MAP = {};

function mapKeys(obj, keyMap) {
  if (!obj || typeof obj !== 'object') return {};
  const out = {};
  for (const [key, value] of Object.entries(obj)) {
    out[keyMap[key] ?? key] = value;
  }
  return out;
}

// v26 の record 内で写真を保持していた可能性のあるフィールド名
const PHOTO_FIELDS = ['photos', 'images', 'photoData'];
const LOCATION_PHOTO_FIELDS = ['locationPhoto', 'locationPhotos', 'positionPhoto'];

/**
 * 旧 record 1件を v27 形式（本体＋写真分離）へ変換する。
 * @returns {{record: Object, images: string[]}}
 */
export function convertLegacyRecord(legacy) {
  const rec = { ...legacy };

  // 写真を本体から抜き出す（通常写真＋位置写真を一本化）
  const images = [];
  for (const field of [...PHOTO_FIELDS, ...LOCATION_PHOTO_FIELDS]) {
    const v = rec[field];
    if (Array.isArray(v)) {
      images.push(...v.filter((s) => typeof s === 'string' && s));
    } else if (typeof v === 'string' && v) {
      images.push(v);
    }
    delete rec[field];
  }

  // 項目キーの対応付け（v26/v27 でキーが同じならそのまま通る）
  rec.scores = mapKeys(rec.scores, SCORE_KEY_MAP);
  rec.health = mapKeys(rec.health, HEALTH_KEY_MAP);

  // id が無い旧データには採番する
  if (!rec.id) {
    rec.id = `legacy-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }

  // 判定値は旧DOM由来の文字列を信用せず、純粋関数で再計算して上書きする
  const { avg, worst, overall } = evaluateRecord(rec, DECLINE_ITEM_IDS);
  rec.avg = avg;
  rec.worstHealth = worst;
  rec.overall = overall ? overall.grade : null;
  rec.overallText = overall ? overall.gradeText : null;

  return { record: rec, images };
}

/**
 * JSON文字列（v26書き出し or v27バックアップ）を解析して records 配列を取り出す。
 */
export function parseBackupJson(jsonText) {
  const data = JSON.parse(jsonText);
  if (Array.isArray(data)) {
    // v26: record の配列を直接書き出していた形式
    return { records: data, photos: null, projects: [] };
  }
  if (data && Array.isArray(data.records)) {
    // v27 バックアップ or v26 の { records: [...] } 形式
    return {
      records: data.records,
      photos: Array.isArray(data.photos) ? data.photos : null,
      projects: Array.isArray(data.projects) ? data.projects : []
    };
  }
  throw new Error('対応していないJSON形式です（records が見つかりません）');
}

/**
 * バックアップJSONを取り込む。
 * @param {string} jsonText
 * @param {'merge'|'overwrite'} mode
 *   merge: id 一致で更新、未知の id は追加（既存の他recordは残す）
 *   overwrite: 全消去してから取り込み（呼び出し側で確認済みであること）
 * @returns {{added: number, updated: number, total: number}}
 */
export async function importBackup(jsonText, mode = 'merge') {
  const { records, photos, projects } = parseBackupJson(jsonText);

  // v27形式（photos 分離済み）なら record はそのまま、
  // v26形式（写真内包）なら変換する
  const converted = records.map((r) => convertLegacyRecord(r));
  const photoRows = new Map();
  for (const { record, images } of converted) {
    if (images.length > 0) photoRows.set(record.id, images);
  }
  // v27バックアップの photos テーブル分をマージ
  if (photos) {
    for (const row of photos) {
      if (row?.recordId && Array.isArray(row.images) && row.images.length > 0) {
        const existing = photoRows.get(row.recordId) ?? [];
        photoRows.set(row.recordId, [...existing, ...row.images]);
      }
    }
  }

  let added = 0;
  let updated = 0;
  await db.transaction('rw', db.records, db.photos, db.projects, async () => {
    if (mode === 'overwrite') {
      await db.records.clear();
      await db.photos.clear();
    }
    for (const { record } of converted) {
      const exists = await db.records.get(record.id);
      if (exists) updated += 1;
      else added += 1;
      await db.records.put(record);
    }
    for (const [recordId, images] of photoRows) {
      await db.photos.put({ recordId, images });
    }
    for (const project of projects) {
      if (project?.id) await db.projects.put(project);
    }
  });

  return { added, updated, total: converted.length };
}
