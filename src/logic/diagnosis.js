// 判定ロジック（純粋関数 = 入力→出力だけで完結し、DOM に依存しない）
//
// 判定基準の出典:
//   一般財団法人 日本緑化センターの衰退度判定基準に準拠。
//   平均評点 <0.8=Ⅰ(良) / <1.6=Ⅱ / <2.4=Ⅲ / <3.2=Ⅳ / ≧3.2=Ⅴ(枯死寸前)
//
// UI・保存データとも、表示は必ずこの関数の返り値を映すだけにする
// （現行v26の「DOM表示文字列を保存する」方式はズレの温床だったため廃止）。

const HEALTH_ORDER = { A: 0, B: 1, C: 2, D: 3 };

/**
 * 活力度の平均評点を計算する（有効項目のみで平均）。
 * @param {Object} scores - { d01: 0〜4, ... } 未入力は undefined/null/'' でよい
 * @param {string[]} enabledIds - 平均に含める項目ID（対象外樹種の項目を除くため）
 * @returns {number|null} 平均評点。入力が1件もなければ null
 */
export function calcDeclineAvg(scores, enabledIds) {
  if (!scores || !Array.isArray(enabledIds)) return null;
  const values = [];
  for (const id of enabledIds) {
    const raw = scores[id];
    if (raw === null || raw === undefined || raw === '') continue;
    const n = Number(raw);
    if (Number.isNaN(n)) continue;
    values.push(n);
  }
  if (values.length === 0) return null;
  const sum = values.reduce((a, b) => a + b, 0);
  return sum / values.length;
}

/**
 * 平均評点から衰退度区分（Ⅰ〜Ⅴ）を返す。
 * @param {number|null} avg
 * @returns {{level: string, text: string}|null}
 */
export function declineLevelFromAvg(avg) {
  if (avg === null || avg === undefined || Number.isNaN(avg)) return null;
  if (avg < 0.8) return { level: 'Ⅰ', text: '良' };
  if (avg < 1.6) return { level: 'Ⅱ', text: 'やや不良' };
  if (avg < 2.4) return { level: 'Ⅲ', text: '不良' };
  if (avg < 3.2) return { level: 'Ⅳ', text: '著しく不良' };
  return { level: 'Ⅴ', text: '枯死寸前' };
}

/**
 * 健全度の最悪グレードを返す（A < B < C < D）。
 * @param {Object} health - { h01: 'A'〜'D', ... } 未入力は無視
 * @returns {'A'|'B'|'C'|'D'|null} 入力が1件もなければ null
 */
export function worstHealth(health) {
  if (!health) return null;
  let worst = null;
  for (const value of Object.values(health)) {
    if (typeof value !== 'string') continue;
    const grade = value.toUpperCase();
    if (!(grade in HEALTH_ORDER)) continue;
    if (worst === null || HEALTH_ORDER[grade] > HEALTH_ORDER[worst]) {
      worst = grade;
    }
  }
  return worst;
}

/**
 * 総合判定（活力度と健全度のうち悪い方で確定）。
 *   worst=D または avg≧3.2 → D 危険木（緊急対応）
 *   worst=C または avg≧2.4 → C 要注意
 *   worst=B または avg≧1.6 → B 健全に近い（経過観察）
 *   上記以外               → A 健全
 * @param {number|null} avg - calcDeclineAvg の結果
 * @param {'A'|'B'|'C'|'D'|null} worst - worstHealth の結果
 * @returns {{grade: string, gradeText: string, declineLevel: string|null}|null}
 *   両方 null（未入力）の場合は null
 */
export function calcOverall(avg, worst) {
  if ((avg === null || avg === undefined) && !worst) return null;
  const decline = declineLevelFromAvg(avg);
  const declineLevel = decline ? decline.level : null;
  const avgNum = avg === null || avg === undefined ? -Infinity : avg;

  if (worst === 'D' || avgNum >= 3.2) {
    return { grade: 'D', gradeText: '危険木（緊急対応）', declineLevel };
  }
  if (worst === 'C' || avgNum >= 2.4) {
    return { grade: 'C', gradeText: '要注意', declineLevel };
  }
  if (worst === 'B' || avgNum >= 1.6) {
    return { grade: 'B', gradeText: '健全に近い（経過観察）', declineLevel };
  }
  return { grade: 'A', gradeText: '健全', declineLevel };
}

/**
 * record の scores / health から判定一式を計算して返すヘルパー。
 * 保存前に必ずこれを通し、avg / worstHealth / overall を record に反映する。
 * @param {Object} record
 * @param {string[]} enabledIds
 * @returns {{avg: number|null, worst: string|null, overall: Object|null}}
 */
export function evaluateRecord(record, enabledIds) {
  const avg = calcDeclineAvg(record?.scores, enabledIds);
  const worst = worstHealth(record?.health);
  const overall = calcOverall(avg, worst);
  return { avg, worst, overall };
}
