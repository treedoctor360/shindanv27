// 健全度（外観診断）判定 14項目マスタ
// 各項目は A（異常なし）〜 D（危険）の4段階で評価する。
// 総合判定は最悪グレード方式（src/logic/diagnosis.js の worstHealth を参照）。
//
// precision: true の項目は、B以下（B/C/D）が入力された時点で
// 「精密診断（機器診断）への誘導」警告バナーの対象になる（機能②）。
// 根拠: 腐朽は外観に現れなくても内部で進行している場合が多いため、
// 子実体・開口空洞・腐朽部露出の外観所見があれば外観診断だけで完結させない。
//
// 【重要】id は v26.8 の record.health のキーと一致させること。
// ずれている場合は src/features/import/importLegacy.js の HEALTH_KEY_MAP で対応。

export const HEALTH_ITEMS = [
  { id: 'h01', label: '梢端・大枝の枯損', group: '樹冠', precision: false },
  { id: 'h02', label: '枝の折損・つり枝', group: '樹冠', precision: false },
  { id: 'h03', label: '幹の傾き', group: '幹', precision: false },
  { id: 'h04', label: '幹の亀裂・割れ', group: '幹', precision: false },
  { id: 'h05', label: '幹の開口空洞', group: '幹', precision: true },
  { id: 'h06', label: '幹の腐朽部露出', group: '幹', precision: true },
  { id: 'h07', label: '子実体（キノコ）の発生', group: '幹・根元', precision: true },
  { id: 'h08', label: '樹皮の剥離・壊死', group: '幹', precision: false },
  { id: 'h09', label: '根元の空洞・腐朽', group: '根', precision: true },
  { id: 'h10', label: '根の露出・切断', group: '根', precision: false },
  { id: 'h11', label: '根鉢の浮き上がり', group: '根', precision: false },
  { id: 'h12', label: '病害・虫害の兆候', group: '全体', precision: false },
  { id: 'h13', label: '支障状況（架空線・構造物等との接触）', group: '立地', precision: false },
  { id: 'h14', label: '対象物（人・建物・道路等）への影響範囲', group: '立地', precision: false }
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
