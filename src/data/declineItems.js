// 活力度（衰退度）判定 17項目マスタ
// 各項目は 0（健全）〜 4（著しく不良）の5段階で評価する。
// 平均評点の区分は 日本緑化センターの衰退度判定基準 に準拠
// （src/logic/diagnosis.js の calcOverall / declineLevelFromAvg を参照）。
//
// 【重要】id は v26.8 の record.scores のキーと一致させること。
// 旧データのインポート時にキーがずれている場合は
// src/features/import/importLegacy.js の SCORE_KEY_MAP で対応付けを行う。

export const DECLINE_ITEMS = [
  { id: 'd01', label: '樹形（自然樹形の崩れ）', group: '樹冠' },
  { id: 'd02', label: '枝の伸長量', group: '樹冠' },
  { id: 'd03', label: '梢端の枯損', group: '樹冠' },
  { id: 'd04', label: '枝の枯損', group: '樹冠' },
  { id: 'd05', label: '枝葉の密度', group: '樹冠' },
  { id: 'd06', label: '葉の大きさ', group: '葉' },
  { id: 'd07', label: '葉色', group: '葉' },
  { id: 'd08', label: '葉の変色・食痕', group: '葉' },
  { id: 'd09', label: '不定芽（胴吹き・ひこばえ）の発生', group: '幹' },
  { id: 'd10', label: '樹皮の状態（剥離・壊死）', group: '幹' },
  { id: 'd11', label: '幹の損傷・亀裂', group: '幹' },
  { id: 'd12', label: '幹の空洞・腐朽', group: '幹' },
  { id: 'd13', label: '子実体（キノコ）の発生', group: '幹' },
  { id: 'd14', label: '根元の状態（腐朽・空洞）', group: '根' },
  { id: 'd15', label: '根の露出・損傷', group: '根' },
  { id: 'd16', label: '土壌の締固め・舗装', group: '立地' },
  { id: 'd17', label: '立地環境（生育空間の制限）', group: '立地' }
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
