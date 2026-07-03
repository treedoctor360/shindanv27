// 活力度（衰退度）判定 17項目マスタ
// 各項目は 0（健全）〜 4（著しく不良）の5段階で評価する。
// 平均評点の区分は 日本緑化センターの衰退度判定基準 に準拠
// （src/logic/diagnosis.js の calcOverall / declineLevelFromAvg を参照）。
//
// 【id について】v26.8 の実データ（backup_20260703.json）と照合。
// v26 の record.scores は英語名キーを使っており、v27 でも同じキーを
// 正式IDとして採用する。実データで確認できたのは入力のあった5キーのみ:
//   sprout / bud / autumnColor / barkTurnover / barkWound
// 残り12項目は v26 のソース（v26.1shindan リポジトリ）で確認するまで
// 仮IDと仮ラベル（confirmed: false）。確認後にキーとラベルを差し替えること。
// ※未知キーの旧データが来ても取り込みは壊れない:
//   インポート時の平均再計算は record.scores に実在するキーで行う
//   （src/features/import/importLegacy.js を参照）。

export const DECLINE_ITEMS = [
  // ---- v26 実データで確認済みのキー ----
  { id: 'bud', label: '芽の状態（大きさ・数）', group: '枝葉', confirmed: true },
  { id: 'sprout', label: '萌芽（胴吹き・ひこばえ）の発生', group: '幹', confirmed: true },
  { id: 'autumnColor', label: '異常紅葉・黄葉', group: '葉', confirmed: true },
  { id: 'barkTurnover', label: '樹皮の新陳代謝（更新）', group: '幹', confirmed: true },
  { id: 'barkWound', label: '樹皮の損傷', group: '幹', confirmed: true },
  // ---- 以下は v26 ソース確認待ちの仮ID・仮ラベル ----
  { id: 'd01', label: '樹形（自然樹形の崩れ）', group: '樹冠', confirmed: false },
  { id: 'd02', label: '枝の伸長量', group: '樹冠', confirmed: false },
  { id: 'd03', label: '梢端の枯損', group: '樹冠', confirmed: false },
  { id: 'd04', label: '枝の枯損', group: '樹冠', confirmed: false },
  { id: 'd05', label: '枝葉の密度', group: '樹冠', confirmed: false },
  { id: 'd06', label: '葉の大きさ', group: '葉', confirmed: false },
  { id: 'd07', label: '葉色', group: '葉', confirmed: false },
  { id: 'd08', label: '葉の変色・食痕', group: '葉', confirmed: false },
  { id: 'd09', label: '幹の損傷・亀裂', group: '幹', confirmed: false },
  { id: 'd10', label: '幹の空洞・腐朽', group: '幹', confirmed: false },
  { id: 'd11', label: '根元の状態（腐朽・空洞）', group: '根', confirmed: false },
  { id: 'd12', label: '根の露出・損傷', group: '根', confirmed: false }
];

// 評点の意味（全項目共通）
export const SCORE_LABELS = [
  { value: 0, label: '0: 異常なし' },
  { value: 1, label: '1: 軽微' },
  { value: 2, label: '2: 中程度' },
  { value: 3, label: '3: 顕著' },
  { value: 4, label: '4: 著しい' }
];

export const DECLINE_ITEM_IDS = DECLINE_ITEMS.map((item) => item.id);
