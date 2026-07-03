// GAS（Google Apps Script）同期 — クラウド共有版
//
// ■ 方針（2026-07-03 変更）
//   スプレッドシート（record）＋ Drive（写真）を「共有マスタ」とする。
//   IndexedDB(Dexie) は現場作業用の作業コピー。保存と共有のしやすさを優先。
//   - アプリ起動/更新のたびに自動でクラウドから record を取り込む（autoPull）
//   - 案件ごとに「☁️ 共有（アップロード）」「⬇️ 読込」ができる
//   - 競合は updatedAt（更新日時）が新しい方を採用
//
// ■ 対応する GAS 側スクリプト: gas/Code.gs（導入手順もそこに記載）
//
// 注意: GAS の Webアプリは CORS のプリフライトに応答しないため、
// POST は Content-Type: text/plain の単純リクエストで送る。GET はそのまま。

import { db } from '../../db/db.js';

const DEFAULT_PROJECT_NAME = '未分類'; // 案件未設定の record が入るシート名
const PHOTO_BATCH = 3; // 写真取得の1リクエストあたり record 数（応答サイズ対策）

async function gasGet(gasUrl, params) {
  const url = `${gasUrl}?${new URLSearchParams(params)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`GAS応答エラー (HTTP ${res.status})`);
  const data = await res.json();
  if (!data.ok) throw new Error(`GAS側エラー: ${data.error ?? '不明'}`);
  return data;
}

async function gasPost(gasUrl, body) {
  const res = await fetch(gasUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify(body)
  });
  if (!res.ok) throw new Error(`GAS送信に失敗しました (HTTP ${res.status})`);
  const data = await res.json();
  if (!data.ok) throw new Error(`GAS側エラー: ${data.error ?? '不明'}`);
  return data;
}

/** 案件名から Dexie の projects を引き、無ければ作って id を返す */
async function ensureProjectByName(name) {
  if (!name || name === DEFAULT_PROJECT_NAME) return '';
  const all = await db.projects.toArray();
  const found = all.find((p) => p.name === name);
  if (found) return found.id;
  const project = {
    id: `proj-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    name,
    createdAt: new Date().toISOString()
  };
  await db.projects.put(project);
  return project.id;
}

/**
 * クラウドの record をローカルへ upsert する（新しい方を採用）。
 * @returns {number} 取り込んだ（追加/更新した）件数
 */
async function upsertCloudRecords(cloudRecords) {
  let applied = 0;
  for (const cloud of cloudRecords) {
    if (!cloud?.id) continue;
    // 案件はシート名（_projectName）→ ローカル projects に名前で対応付ける
    const projectId = await ensureProjectByName(cloud._projectName);
    const rec = { ...cloud, projectId, _sentToGAS: true };
    delete rec._projectName;

    const local = await db.records.get(rec.id);
    // ローカルの方が新しければ残す（現場で編集中の内容を消さない）
    if (local?.updatedAt && rec.updatedAt && local.updatedAt > rec.updatedAt) continue;
    await db.records.put(rec);
    applied += 1;
  }
  return applied;
}

/** クラウドから写真を取り込み、photos テーブルへ保存する */
async function pullPhotosFor(gasUrl, recordIds) {
  let count = 0;
  for (let i = 0; i < recordIds.length; i += PHOTO_BATCH) {
    const batch = recordIds.slice(i, i + PHOTO_BATCH);
    const data = await gasGet(gasUrl, { action: 'photos', ids: batch.join(',') });
    for (const row of data.photos ?? []) {
      if (row?.recordId && Array.isArray(row.images) && row.images.length > 0) {
        await db.photos.put({ recordId: row.recordId, images: row.images });
        count += row.images.length;
      }
    }
  }
  return count;
}

/**
 * 起動時の自動取り込み: クラウドの全 record をローカルへ upsert する（非破壊）。
 * 写真は重いのでここでは取らない（案件の「⬇️ 読込」または編集時に取得）。
 * @returns {{applied: number, total: number}}
 */
export async function autoPull(gasUrl) {
  const data = await gasGet(gasUrl, { action: 'records' });
  const applied = await upsertCloudRecords(data.records ?? []);
  return { applied, total: (data.records ?? []).length };
}

/**
 * 案件を指定してクラウドから読み込む（写真込み）。
 * mode='replace' はその案件のローカル record を一旦消してクラウドの内容に置き換える。
 * 呼び出し側で未共有の変更が消える旨の確認を済ませてから呼ぶこと。
 * @param {string} gasUrl
 * @param {string} projectName - シート名（'' なら全案件を upsert で取り込み）
 * @param {'replace'|'merge'} mode
 * @returns {{records: number, photos: number}}
 */
export async function pullProject(gasUrl, projectName, mode = 'replace') {
  const data = await gasGet(gasUrl, {
    action: 'records',
    ...(projectName ? { project: projectName } : {})
  });
  const cloudRecords = data.records ?? [];

  if (mode === 'replace' && projectName) {
    // その案件のローカル record を置き換える
    const projectId = await ensureProjectByName(projectName);
    const locals = await db.records
      .filter((r) => (projectId ? r.projectId === projectId : !r.projectId))
      .toArray();
    await db.transaction('rw', db.records, db.photos, async () => {
      for (const r of locals) {
        await db.records.delete(r.id);
        await db.photos.delete(r.id);
      }
    });
    // 置き換えなので updatedAt ガードを効かせず全件入れる
    for (const cloud of cloudRecords) {
      const pid = await ensureProjectByName(cloud._projectName);
      const rec = { ...cloud, projectId: pid, _sentToGAS: true };
      delete rec._projectName;
      await db.records.put(rec);
    }
  } else {
    await upsertCloudRecords(cloudRecords);
  }

  const photos = await pullPhotosFor(gasUrl, cloudRecords.map((r) => r.id));
  return { records: cloudRecords.length, photos };
}

/**
 * 案件を指定してクラウドへ共有（アップロード）する（写真込み）。
 * @param {string} gasUrl
 * @param {string} projectName - 送信先シート名（'' は「未分類」へ）
 * @param {Object[]} records - 送信する record（その案件の全件を渡す想定）
 * @returns {{sent: number, photos: number}}
 */
export async function pushProject(gasUrl, projectName, records) {
  if (!gasUrl) throw new Error('GAS URL が設定されていません');
  if (!records || records.length === 0) return { sent: 0, photos: 0 };

  // 紐づく写真を集める
  const rows = await db.photos.bulkGet(records.map((r) => r.id));
  const photos = rows
    .filter((row) => row && Array.isArray(row.images) && row.images.length > 0)
    .map((row) => ({ recordId: row.recordId, images: row.images }));

  const data = await gasPost(gasUrl, {
    action: 'push',
    projectName: projectName || DEFAULT_PROJECT_NAME,
    records,
    photos
  });

  // 送信済みフラグを立てる
  const now = new Date().toISOString();
  await db.transaction('rw', db.records, async () => {
    for (const r of records) {
      await db.records.update(r.id, { _sentToGAS: true, _sentToGASAt: now });
    }
  });
  return { sent: data.saved ?? records.length, photos: photos.length };
}

/** クラウド上の案件名（シート名）一覧 */
export async function fetchCloudProjects(gasUrl) {
  const data = await gasGet(gasUrl, { action: 'projects' });
  return data.projects ?? [];
}

/** 未送信 record の抽出 */
export function selectUnsent(records) {
  return records.filter((r) => !r._sentToGAS);
}
