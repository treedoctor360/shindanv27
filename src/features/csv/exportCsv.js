// CSV出力 — v26.8 の exportAllToCSV を移植（列構成・BOM付きUTF-8 とも互換）
import { dlBlob } from '../download.js';
import { declineLevelFromAvg } from '../../logic/diagnosis.js';

const HEADER = [
  '樹木No', '調査日', '天候', '調査者', '樹種名', '所在地',
  '樹高(m)', '幹周(cm)', '緯度', '経度', '総合判定',
  '活力度', '健全度', '腐朽菌', '所見', '必要な措置'
];

/**
 * records を v26 互換のCSVとしてダウンロードさせる。
 * @returns {number} 出力件数
 */
export function exportRecordsToCsv(records) {
  if (!records || records.length === 0) return 0;

  const rows = records.map((r) => {
    const decline = declineLevelFromAvg(r.avg);
    return [
      r.treeNo || '',
      r.surveyDate || '',
      r.weather || '',
      r.inspector || '',
      r.species || '',
      r.location || '',
      r.treeHeight || '',
      r.trunkGirth || '',
      r.latitude || '',
      r.longitude || '',
      r.overall || '',
      decline ? `${decline.level}（${decline.text}）` : '',
      r.worstHealth || '',
      [...(r.fungus || []), r.fungusOther || ''].filter(Boolean).join('、'),
      r.comment || '',
      (r.measures || []).join('、')
    ];
  });

  const csv = [HEADER, ...rows]
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\n');

  // 先頭のBOM(﻿)はExcelで文字化けさせないためのおまじない（v26と同じ）
  dlBlob(
    new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' }),
    `樹木点検一覧_${new Date().toISOString().slice(0, 10)}.csv`
  );
  return records.length;
}
