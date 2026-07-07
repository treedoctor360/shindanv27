// 帳票Excel（1本ごとの詳細様式）— v26.8 の printRecord を移植
// 様式Ⅰ-1（調査木位置図）・様式Ⅰ-2（衰退度判定票）・様式Ⅰ-3（危険度判定票）の
// 3シート構成。ファイル名は v26 と同じ「詳細_<樹木No>.xlsx」。

import { DECLINE_ITEMS } from '../../data/declineItems.js';
import { HEALTH_ITEMS } from '../../data/healthItems.js';
import { declineLevelFromAvg } from '../../logic/diagnosis.js';
import { dlBlob } from '../download.js';

function setColWidths(ws, widths) {
  ws['!cols'] = widths.map((w) => ({ wch: w }));
}

// 健全度は項目ごとに使えるグレードが違うため、A〜D各列の説明文を引く
function gradeDesc(item, grade) {
  return item.grades.find((g) => g.value === grade)?.label ?? '—';
}

/**
 * record 1件を様式Ⅰ-1〜Ⅰ-3のExcelとしてダウンロードさせる。
 */
export async function exportFormExcel(record) {
  const XLSX = await import('xlsx');
  const r = record;
  const wb = XLSX.utils.book_new();

  // ---- 様式Ⅰ-1 調査木位置図 ----
  const ws1 = XLSX.utils.aoa_to_sheet([
    ['様式Ⅰ-1　調査木位置図', '', '', '', '', '', '', ''],
    ['樹木No.', r.treeNo, '調査日', r.surveyDate, '天候', r.weather, '調査者', r.inspector],
    ['樹種名', r.species, '', '', '科名', r.family, '', ''],
    ['学名', r.scientificName, '', '', '樹木の名称(愛称)', r.nickname, '', ''],
    ['所在地', r.location, '', '', '', '', '', ''],
    ['樹高(m)', r.treeHeight, '幹周(cm)', r.trunkGirth, '', '', '', ''],
    ['緯度', r.latitude, '経度', r.longitude, '', '', '', '']
  ]);
  setColWidths(ws1, [20, 20, 15, 20, 15, 20, 15, 20]);
  XLSX.utils.book_append_sheet(wb, ws1, '様式Ⅰ-1_位置図');

  // ---- 様式Ⅰ-2 地上部の衰退度判定票 ----
  const decline = declineLevelFromAvg(r.avg);
  const ws2 = XLSX.utils.aoa_to_sheet([
    ['様式Ⅰ-2　地上部の衰退度判定票', '', '', '', '', '', '', '', '', '', '', ''],
    ['評価項目', '0', '', '1', '', '2', '', '3', '', '4', '', '評点'],
    ...DECLINE_ITEMS.map((it) => [
      it.label,
      it.desc[0], '', it.desc[1], '', it.desc[2], '', it.desc[3], '', it.desc[4], '',
      r.scores?.[it.id] ?? ''
    ]),
    ['', '', '', '', '', '', '', '', '', '', '', ''],
    ['衰退度（平均評点）', '', '', '', '', '', '', '', '', '', '', r.avg != null ? Number(r.avg).toFixed(2) : ''],
    ['判定区分', '', '', '', '', '', '', '', '', '', '', decline ? `${decline.level}（${decline.text}）` : '']
  ]);
  setColWidths(ws2, [12, 30, 2, 30, 2, 30, 2, 30, 2, 30, 2, 8]);
  XLSX.utils.book_append_sheet(wb, ws2, '様式Ⅰ-2_衰退度');

  // ---- 様式Ⅰ-3 倒木、枝折れ等危険度判定票 ----
  const ws3 = XLSX.utils.aoa_to_sheet([
    ['様式Ⅰ-3　倒木、枝折れ等危険度判定票', '', '', '', '', '', ''],
    ['項目', '', 'A(0)', 'B(1)', 'C(2)', 'D(3)', '判定'],
    ...HEALTH_ITEMS.map((it) => [
      it.label, '',
      gradeDesc(it, 'A'), gradeDesc(it, 'B'), gradeDesc(it, 'C'), gradeDesc(it, 'D'),
      r.health?.[it.id] ?? ''
    ]),
    ['腐朽菌', '', '', '', '', '', [...(r.fungus || []), r.fungusOther].filter(Boolean).join('、')],
    ['総合判定', '', '', '', '', '', r.overall ?? ''],
    ['所見', '', '', '', '', '', r.comment ?? ''],
    ['必要な措置', '', '', '', '', '', (r.measures || []).join('、')]
  ]);
  setColWidths(ws3, [20, 5, 30, 30, 30, 30, 15]);
  XLSX.utils.book_append_sheet(wb, ws3, '様式Ⅰ-3_危険度');

  dlBlob(
    new Blob([XLSX.write(wb, { bookType: 'xlsx', type: 'array' })], {
      type: 'application/octet-stream'
    }),
    `詳細_${r.treeNo || r.id}.xlsx`
  );
}
