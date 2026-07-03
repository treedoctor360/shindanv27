// Excel出力（SheetJS / xlsx）— 現行v26の出力を継承
// records を1行=1本の一覧表として書き出す。

import { DECLINE_ITEMS } from '../../data/declineItems.js';
import { HEALTH_ITEMS } from '../../data/healthItems.js';

/**
 * records を Excel ファイルとしてダウンロードさせる。
 * xlsx は大きいので動的 import（出力時に初めて読み込む）にして起動を軽くする。
 * @param {Object[]} records
 * @param {string} [filename]
 */
export async function exportRecordsToExcel(records, filename) {
  const XLSX = await import('xlsx');
  const rows = records.map((r) => {
    const row = {
      '樹木番号': r.treeNo ?? '',
      '調査日': r.surveyDate ?? '',
      '天候': r.weather ?? '',
      '調査者': r.inspector ?? '',
      '樹種': r.species ?? '',
      '科名': r.family ?? '',
      '学名': r.scientificName ?? '',
      '愛称': r.nickname ?? '',
      '場所': r.location ?? '',
      '樹高(m)': r.treeHeight ?? '',
      '幹周(cm)': r.trunkGirth ?? '',
      '緯度': r.latitude ?? '',
      '経度': r.longitude ?? ''
    };
    for (const item of DECLINE_ITEMS) {
      row[`活力:${item.label}`] = r.scores?.[item.id] ?? '';
    }
    for (const item of HEALTH_ITEMS) {
      row[`健全:${item.label}`] = r.health?.[item.id] ?? '';
    }
    row['活力度平均'] = r.avg ?? '';
    row['健全度最悪'] = r.worstHealth ?? '';
    row['総合判定'] = r.overall ?? '';
    row['腐朽菌'] = Array.isArray(r.fungus) ? r.fungus.join('、') : '';
    row['腐朽菌(その他)'] = r.fungusOther ?? '';
    row['所見'] = r.comment ?? '';
    row['対策'] = Array.isArray(r.measures) ? r.measures.join('、') : '';
    return row;
  });

  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, '診断記録');
  const name = filename ?? `樹木診断_${new Date().toISOString().slice(0, 10)}.xlsx`;
  XLSX.writeFile(wb, name);
}
