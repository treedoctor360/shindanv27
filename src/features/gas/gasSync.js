// GAS（Google Apps Script）同期 — 現行v26のスプレッドシート同期を継承
// 設定画面で保存した gasUrl へ records を POST する。
//
// 注意: GAS の Webアプリは CORS のプリフライトに応答しないため、
// 現行版と同じく Content-Type を text/plain にして単純リクエストで送る。

import { db } from '../../db/db.js';

/**
 * 未送信の record を GAS へ送信し、成功したものに送信済みフラグを立てる。
 * @param {string} gasUrl - GAS WebアプリのURL
 * @param {Object[]} records - 送信対象（未送信のみ渡すのが基本）
 * @returns {{sent: number}} 送信件数
 */
export async function syncToGAS(gasUrl, records) {
  if (!gasUrl) throw new Error('GAS URL が設定されていません');
  if (!records || records.length === 0) return { sent: 0 };

  const res = await fetch(gasUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify({ records })
  });
  if (!res.ok) {
    throw new Error(`GAS送信に失敗しました (HTTP ${res.status})`);
  }

  // 送信済みフラグを Dexie に反映
  const now = new Date().toISOString();
  await db.transaction('rw', db.records, async () => {
    for (const r of records) {
      await db.records.update(r.id, { _sentToGAS: true, _sentToGASAt: now });
    }
  });
  return { sent: records.length };
}

/** 未送信 record の抽出 */
export function selectUnsent(records) {
  return records.filter((r) => !r._sentToGAS);
}
