// 健全度（外観診断）判定 14項目マスタ
// 各項目は A（異常なし）〜 D（危険）の4段階で評価する。
// 総合判定は最悪グレード方式（src/logic/diagnosis.js の worstHealth を参照）。
//
// 【id について】v26.8 の実データ（backup_20260703.json）と照合済み。
// v26 の record.health は英語名キーを使っており、v27 でも互換のため
// 同じキーをそのまま正式IDとして採用する（変換マップ不要・GAS同期も互換）。
// 14キー全件を実データで確認済み。
// ※日本語ラベルはキー名からの推定。v26 の画面表記と異なっていれば直すこと。
//
// precision: true の項目は、B以下（B/C/D）が入力された時点で
// 「精密診断（機器診断）への誘導」警告バナーの対象になる（機能②）。
// 根拠: 腐朽は外観に現れなくても内部で進行している場合が多いため、
// 子実体・開口空洞・腐朽部露出の外観所見があれば外観診断だけで完結させない。

export const HEALTH_ITEMS = [
  { id: 'hangingBranch', label: '枯枝・つり枝（かかり枝）', group: '樹冠', precision: false },
  { id: 'jointAbnormality', label: '枝の付け根（分岐部）の異常・入り皮', group: '樹冠', precision: false },
  { id: 'lean', label: '幹の傾き', group: '幹', precision: false },
  { id: 'sway', label: '樹体の動揺（ぐらつき）', group: '幹・根', precision: false },
  { id: 'crack', label: '幹の亀裂・割れ', group: '幹', precision: false },
  { id: 'cavity', label: '幹の開口空洞', group: '幹', precision: true },
  { id: 'decayExposed', label: '腐朽部の露出', group: '幹', precision: true },
  { id: 'fungusBody', label: '子実体（キノコ）の発生', group: '幹・根元', precision: true },
  { id: 'bulge', label: '幹のふくらみ・こぶ', group: '幹', precision: false },
  { id: 'barkDamage', label: '樹皮の損傷・剥離', group: '幹', precision: false },
  { id: 'tappingSound', label: '打音の異常', group: '幹', precision: false },
  { id: 'penetrationAbnormality', label: '貫入の異常（刺し込み抵抗）', group: '幹', precision: false },
  { id: 'rootVisible', label: '根の露出・損傷', group: '根', precision: false },
  { id: 'pestDamage', label: '病害・虫害の兆候', group: '全体', precision: false }
];

// グレードの意味（全項目共通）
export const HEALTH_GRADES = [
  { value: 'A', label: 'A: 異常なし' },
  { value: 'B', label: 'B: 軽微な異常' },
  { value: 'C', label: 'C: 顕著な異常' },
  { value: 'D', label: 'D: 危険な異常' }
];

export const HEALTH_ITEM_IDS = HEALTH_ITEMS.map((item) => item.id);

// 機能②の警告対象となる項目ID
export const PRECISION_TRIGGER_IDS = HEALTH_ITEMS.filter((i) => i.precision).map((i) => i.id);
