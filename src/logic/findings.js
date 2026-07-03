// 機能①: 所見の言語化（record を入力とする純粋関数）
// 判定根拠を文章化し、所見欄への「ドラフト挿入」に使う。
// 成り立ての樹木医が「観察はできたが言語化できない」場面を肩代わりする。

import { DECLINE_ITEMS, DECLINE_ITEM_IDS } from '../data/declineItems.js';
import { HEALTH_ITEMS, PRECISION_TRIGGER_IDS } from '../data/healthItems.js';
import { evaluateRecord } from './diagnosis.js';

const HEALTH_ORDER = { A: 0, B: 1, C: 2, D: 3 };

function itemLabel(items, id) {
  const found = items.find((i) => i.id === id);
  return found ? found.label : id;
}

/**
 * 判定根拠を文章化した所見ドラフトを生成する。
 * @param {Object} record - 診断record（scores / health / fungus 等を含む）
 * @param {string[]} [enabledIds] - 活力度の有効項目ID（省略時は全17項目）
 * @returns {{text: string, lines: string[], grade: string|null}}
 */
export function generateFindings(record, enabledIds = DECLINE_ITEM_IDS) {
  const { avg, worst, overall } = evaluateRecord(record, enabledIds);
  const lines = [];

  if (!overall) {
    return {
      text: '（活力度・健全度が未入力のため所見を生成できません）',
      lines: [],
      grade: null
    };
  }

  // --- 総合判定 ---
  const avgText = avg === null ? '—' : avg.toFixed(2);
  lines.push(
    `総合判定は ${overall.grade}（${overall.gradeText}）。` +
      `活力度平均評点 ${avgText}` +
      (overall.declineLevel ? `（衰退度 ${overall.declineLevel}）` : '') +
      `、健全度最悪グレード ${worst ?? '—'}。`
  );

  // --- 判定を決定づけた健全度項目 ---
  // 総合判定と同グレードの健全度項目を「決定づけた項目」として明示する
  if (worst && HEALTH_ORDER[worst] >= HEALTH_ORDER[overall.grade]) {
    const decisive = Object.entries(record.health ?? {})
      .filter(([, v]) => typeof v === 'string' && v.toUpperCase() === worst)
      .map(([id]) => itemLabel(HEALTH_ITEMS, id));
    if (decisive.length > 0) {
      lines.push(
        `健全度で ${worst} と評価した項目: ${decisive.join('、')}。` +
          `これが総合判定の主たる根拠である。`
      );
    }
  }

  // --- 活力度で評点の高い（悪い）上位項目 ---
  const scored = enabledIds
    .map((id) => ({ id, score: Number(record.scores?.[id]) }))
    .filter((e) => !Number.isNaN(e.score) && record.scores?.[e.id] !== '' && record.scores?.[e.id] !== null && record.scores?.[e.id] !== undefined)
    .filter((e) => e.score >= 2)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);
  if (scored.length > 0) {
    const parts = scored.map((e) => `${itemLabel(DECLINE_ITEMS, e.id)}（評点${e.score}）`);
    lines.push(`活力度で評点の高い（状態の悪い）項目: ${parts.join('、')}。`);
  }

  // --- 腐朽菌の記録 ---
  const fungus = Array.isArray(record.fungus) ? record.fungus.filter(Boolean) : [];
  if (fungus.length > 0 || record.fungusOther) {
    const names = [...fungus];
    if (record.fungusOther) names.push(record.fungusOther);
    lines.push(`子実体の確認: ${names.join('、')}。内部腐朽の進行が疑われる。`);
  }

  // --- 精密診断への誘導（機能②と整合する一文） ---
  if (needsPrecisionDiagnosis(record)) {
    lines.push(
      '外観上、内部腐朽を示唆する所見（子実体・開口空洞・腐朽部露出等）が認められるため、' +
        '機器診断（打音・貫入抵抗・レジストグラフ等）の要否を検討する必要がある。'
    );
  }

  return { text: lines.join('\n'), lines, grade: overall.grade };
}

/**
 * 機能②: 精密診断（機器診断）への誘導が必要か判定する。
 * 健全度の 子実体・開口空洞・腐朽部露出（根元含む）に B以下 の入力があるか、
 * 腐朽菌の記録があれば true。
 * @param {Object} record
 * @returns {boolean}
 */
export function needsPrecisionDiagnosis(record) {
  if (!record) return false;
  const health = record.health ?? {};
  const hit = PRECISION_TRIGGER_IDS.some((id) => {
    const v = health[id];
    return typeof v === 'string' && ['B', 'C', 'D'].includes(v.toUpperCase());
  });
  if (hit) return true;
  const fungus = Array.isArray(record.fungus) ? record.fungus.filter(Boolean) : [];
  return fungus.length > 0 || Boolean(record.fungusOther);
}
