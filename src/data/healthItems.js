// 健全度（外観診断）判定 14項目マスタ
// 各項目は A（異常なし）〜 D（危険）で評価する。ただし項目ごとに
// 「該当なし」で使わないグレードがある（v26 の inactive 指定）。
// grades に「実際に選べるグレードと、その項目固有の説明文」だけを持たせる。
// 総合判定は最悪グレード方式（src/logic/diagnosis.js の worstHealth を参照）。
//
// 【id・項目名・グレード文言は v26.1shindan のソースと照合済み（全14項目確定）】
// v26 の record.health は英語名キーを使っており、v27 も同じキーを正式IDとして採用。
//
// precision: true の項目（子実体・開口空洞・腐朽部露出）は、A以外が入力されたら
// 「精密診断（機器診断）への誘導」警告バナーの対象になる（機能②）。
// 根拠: 腐朽は外観に現れなくても内部で進行している場合が多いため、
// これらの外観所見があれば外観診断だけで完結させない。

export const HEALTH_ITEMS = [
  { id: 'sway', label: '揺らぎ', group: '幹', precision: false, grades: [
    { value: 'A', label: 'なし' }, { value: 'C', label: 'あり（小）' }, { value: 'D', label: 'あり（大）' }
  ] },
  { id: 'lean', label: '不自然な傾斜', group: '幹', precision: false, grades: [
    { value: 'A', label: 'なし' }, { value: 'B', label: '根付き異常なし' }, { value: 'D', label: '地際変状あり' }
  ] },
  { id: 'crack', label: '亀裂', group: '幹', precision: false, grades: [
    { value: 'A', label: 'なし' }, { value: 'C', label: 'あり（小）' }, { value: 'D', label: 'あり（大）' }
  ] },
  { id: 'fungusBody', label: '子実体（キノコ）', group: '幹・根元', precision: true, grades: [
    { value: 'A', label: 'なし' }, { value: 'C', label: 'あり（小）' }, { value: 'D', label: 'あり（大）' }
  ] },
  { id: 'cavity', label: '開口空洞', group: '幹', precision: true, grades: [
    { value: 'A', label: 'なし' }, { value: 'B', label: '芯に達しない' }, { value: 'C', label: '芯に達し1/3未満' }, { value: 'D', label: '芯に達し1/3以上' }
  ] },
  { id: 'bulge', label: '隆起', group: '幹', precision: false, grades: [
    { value: 'A', label: 'なし' }, { value: 'C', label: 'あり（小）' }, { value: 'D', label: 'あり（大）' }
  ] },
  { id: 'decayExposed', label: '腐朽部露出', group: '幹', precision: true, grades: [
    { value: 'A', label: 'なし' }, { value: 'C', label: '周囲長比1/3未満' }, { value: 'D', label: '周囲長比1/3以上' }
  ] },
  { id: 'barkDamage', label: '樹皮枯死・欠損', group: '幹', precision: false, grades: [
    { value: 'A', label: 'なし' }, { value: 'B', label: '周囲長比1/3未満' }, { value: 'C', label: '周囲長比1/3以上' }
  ] },
  { id: 'jointAbnormality', label: '結合部の変状', group: '樹冠', precision: false, grades: [
    { value: 'A', label: 'なし' }, { value: 'C', label: 'あり（小）' }, { value: 'D', label: 'あり（大）' }
  ] },
  { id: 'pestDamage', label: '穿孔害虫等', group: '全体', precision: false, grades: [
    { value: 'A', label: 'なし' }, { value: 'B', label: 'あり（小）' }, { value: 'C', label: 'あり（大）' }
  ] },
  { id: 'rootVisible', label: '根張り', group: '根', precision: false, grades: [
    { value: 'A', label: '見える' }, { value: 'C', label: '見えない' }
  ] },
  { id: 'tappingSound', label: '打診音異常', group: '幹', precision: false, grades: [
    { value: 'A', label: 'なし' }, { value: 'C', label: 'あり（小）' }, { value: 'D', label: 'あり（大）' }
  ] },
  { id: 'penetrationAbnormality', label: '貫入異常', group: '幹', precision: false, grades: [
    { value: 'A', label: 'なし' }, { value: 'C', label: 'あり（小）' }, { value: 'D', label: 'あり（大）' }
  ] },
  { id: 'hangingBranch', label: 'ぶら下がり枝', group: '樹冠', precision: false, grades: [
    { value: 'A', label: 'なし' }, { value: 'B', label: 'あり（小）' }, { value: 'C', label: 'あり（大）' }
  ] }
];

// グレードの意味（フォールバック表示用）
export const HEALTH_GRADES = [
  { value: 'A', label: 'A: 異常なし' },
  { value: 'B', label: 'B: 軽微な異常' },
  { value: 'C', label: 'C: 顕著な異常' },
  { value: 'D', label: 'D: 危険な異常' }
];

export const HEALTH_ITEM_IDS = HEALTH_ITEMS.map((item) => item.id);

// 機能②の警告対象となる項目ID
export const PRECISION_TRIGGER_IDS = HEALTH_ITEMS.filter((i) => i.precision).map((i) => i.id);
