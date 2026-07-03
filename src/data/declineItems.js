// 活力度（衰退度）判定 17項目マスタ
// 各項目は 0（健全）〜 4（著しく不良）の5段階で評価する。
// 平均評点の区分は 日本緑化センターの衰退度判定基準 に準拠
// （src/logic/diagnosis.js の calcOverall / declineLevelFromAvg を参照）。
//
// 【id・項目名・評点文言（desc）は v26.1shindan のソースと照合済み（全17項目確定）】
// v26 の record.scores は英語名キーを使っており、v27 も同じキーを正式IDとして採用。
// desc は各評点（0〜4）に対応するv26の説明文で、ボタン入力のラベルに使う。

export const DECLINE_ITEMS = [
  { id: 'vigor', label: '樹勢', group: '全体', desc: ['旺盛で被害なし', '幾分影響あるが目立たず', '異常が明らか', '極めて劣悪', 'ほとんど枯死'] },
  { id: 'shape', label: '樹形', group: '樹形', desc: ['自然樹形', '若干の乱れ', '大きく変化', '乱れ著しい', '完全に崩壊'] },
  { id: 'density', label: '枝葉密度', group: '樹冠', desc: ['十分な量', 'やや劣る', '枯枝目立つ、やや少ない', '著しく少ない', 'ほとんど葉なし'] },
  { id: 'shoot', label: '枝伸長量', group: '樹冠', desc: ['十分伸長', 'やや小さい', '短く細い', '極度に短小', '萌芽のみ'] },
  { id: 'leafSize', label: '葉の大きさ', group: '葉', desc: ['十分な大きさ', '所々小さい', '全体にやや小', '著しく小', 'わずかで小さい'] },
  { id: 'leafColor', label: '葉色', group: '葉', desc: ['濃い緑色', 'やや薄い緑', '黄変目立つ', '大部分薄緑', '薄緑・黄変のみ'] },
  { id: 'topDieback', label: '梢端枯損', group: '樹冠', desc: ['なし', '少し', '随所にあり', 'かなり目立つ', '梢端・主枝なし'] },
  { id: 'lowerDieback', label: '下枝枯損', group: '樹冠', desc: ['なし', '少し', '随所・切断目立つ', 'かなり目立つ', '健全枝端なし'] },
  { id: 'largeBranch', label: '大枝欠損', group: '樹冠', desc: ['なし', '少し回復', '随所に目立つ', 'かなり目立つ', '幹上部喪失'] },
  { id: 'pruning', label: '剪定痕', group: '幹', desc: ['旺盛に巻込', '巻込成長', '活力なし', 'ほとんど巻込なし', '全く巻込なし'] },
  { id: 'barkWound', label: '樹皮傷', group: '幹', desc: ['ほとんどなし', '少し', '古傷残る', '腐朽著しい', '大空洞・剥がれ'] },
  { id: 'barkTurnover', label: '新陳代謝', group: '幹', desc: ['活発', '一部不活発', '全体に活力なし', '著しく衰弱', '大部分壊死'] },
  { id: 'sprout', label: '胴吹き', group: '幹', desc: ['なし', '枝葉多いが胴吹きあり', '枝葉少＋胴吹きあり', '枝葉極少＋胴吹き多', '枝葉極少＋胴吹き少'] },
  { id: 'bud', label: '芽', group: '芽', desc: ['大きく多数', 'やや劣る', '小さい/少ない', '著しく少なく貧弱', 'ほとんど見られず'] },
  { id: 'autumnColor', label: '紅黄葉', group: '葉', desc: ['鮮やか', 'やや劣る', '一部のみ', '見られない', '正常な紅黄葉なし'] },
  { id: 'flower', label: '開花', group: '花', desc: ['花つき良好', 'やや劣る', '花小さく疎', '小さい花多く疎', 'ほとんど開花なし'] },
  { id: 'fruit', label: '結実', group: '実', desc: ['実つき良好', 'やや劣る', '実小さく疎', '小さい実多く疎', 'ほとんど結実なし'] }
];

// 評点の意味（項目に desc が無い場合のフォールバック）
export const SCORE_LABELS = [
  { value: 0, label: '0: 異常なし' },
  { value: 1, label: '1: 軽微' },
  { value: 2, label: '2: 中程度' },
  { value: 3, label: '3: 顕著' },
  { value: 4, label: '4: 著しい' }
];

export const DECLINE_ITEM_IDS = DECLINE_ITEMS.map((item) => item.id);
