// 機能③: 樹種・腐朽菌の知識マスタ
//
// 【運用ルール（CLAUDE.md §4-③）】
// - 内容の事実は 日本緑化センター・日本樹木医会・樹木医学会 等の
//   公的資料で裏取りしてから登録する。出典不明のまとめサイトは使わない。
// - 各項目に必ず source（出典）フィールドを持たせる。
// - verified: false の項目は「裏取り前の下書き」であり、UI上に
//   「出典確認中」の注記付きで表示される。本運用までに必ず裏取りすること。
//
// ここに登録済みの内容は樹木医学の標準的な教科書・公的資料で広く
// 記載のある一般的知見だが、登録時点では原典ページの照合を行っていないため
// すべて verified: false で登録している。裏取り完了後に true へ変更する。

// ---- 樹種マスタ ----
// pests: 頻出病虫害, notes: 診断上の留意点
export const SPECIES_KNOWLEDGE = [
  {
    species: 'ソメイヨシノ',
    family: 'バラ科',
    scientificName: 'Cerasus × yedoensis',
    pests: ['てんぐ巣病', 'コスカシバ（幹の食入）', 'ベッコウタケ（根株腐朽）', '胴枯病'],
    notes: '老木では根株腐朽の進行が早い傾向。切り口からの腐朽が入りやすく、剪定後の経過観察が重要。',
    source: '日本樹木医会「樹木医必携」/ 日本緑化センター資料（要ページ照合）',
    verified: false
  },
  {
    species: 'クスノキ',
    family: 'クスノキ科',
    scientificName: 'Cinnamomum camphora',
    pests: ['クスサン', 'クスベニヒラタカスミカメ（葉の変色）', 'イセリアカイガラムシ'],
    notes: '萌芽力が強く樹勢回復しやすい。大径木では幹の空洞化があっても外観上樹勢が良い場合があるため注意。',
    source: '日本樹木医会「樹木医必携」（要ページ照合）',
    verified: false
  },
  {
    species: 'ケヤキ',
    family: 'ニレ科',
    scientificName: 'Zelkova serrata',
    pests: ['ニレチュウレンジ', 'ケヤキフシアブラムシ', 'ベッコウタケ（根株腐朽）'],
    notes: '大枝の付け根の入り皮（含み皮）から割れ・落枝に至る事例が知られる。株立ち状の幹の分岐部を確認。',
    source: '日本樹木医会「樹木医必携」（要ページ照合）',
    verified: false
  },
  {
    species: 'イチョウ',
    family: 'イチョウ科',
    scientificName: 'Ginkgo biloba',
    pests: ['病虫害は比較的少ない'],
    notes: '病虫害に強く大気汚染にも強い。乳（気根状突起）は異常ではない。台風時の大枝折損に注意。',
    source: '日本緑化センター「緑の読本」等（要ページ照合）',
    verified: false
  },
  {
    species: 'マツ（クロマツ・アカマツ）',
    family: 'マツ科',
    scientificName: 'Pinus thunbergii / P. densiflora',
    pests: ['マツ材線虫病（マツノザイセンチュウ）', 'マツカレハ', '葉ふるい病'],
    notes: '針葉の急激な赤変はマツ材線虫病を第一に疑う。夏以降の急激な衰退は要緊急対応。',
    source: '林野庁 松くい虫被害対策資料 / 日本緑化センター（要ページ照合）',
    verified: false
  }
];

// ---- 腐朽菌マスタ ----
// decayPart: 材質腐朽の主な部位, riskNote: 倒木・折損リスクの目安
export const FUNGUS_KNOWLEDGE = [
  {
    name: 'ベッコウタケ',
    decayType: '白色腐朽',
    decayPart: '根株・根系',
    riskNote: '根株腐朽の代表種。外観上樹勢が良くても根系の腐朽が進み倒木に至る事例が多い。子実体確認時は精密診断を強く推奨。',
    source: '日本樹木医会「樹木医必携」/ 樹木医学会資料（要ページ照合）',
    verified: false
  },
  {
    name: 'コフキタケ（コフキサルノコシカケ）',
    decayType: '白色腐朽',
    decayPart: '幹（心材中心）',
    riskNote: '幹の心材腐朽を進行させる。大径木の幹折れリスクの目安となる。発生高さ付近の残存壁厚の確認が必要。',
    source: '日本樹木医会「樹木医必携」（要ページ照合）',
    verified: false
  },
  {
    name: 'カワラタケ',
    decayType: '白色腐朽',
    decayPart: '枯死部・辺材',
    riskNote: '主に枯死した部位に発生。生立木では衰退・枯損部の存在を示す指標となる。',
    source: '日本樹木医会「樹木医必携」（要ページ照合）',
    verified: false
  },
  {
    name: 'マンネンタケ',
    decayType: '白色腐朽',
    decayPart: '根株・根元',
    riskNote: '根株腐朽を起こす。根元周辺の子実体は根系腐朽進行の兆候として扱う。',
    source: '日本樹木医会「樹木医必携」（要ページ照合）',
    verified: false
  },
  {
    name: 'エブリコ・その他不明',
    decayType: '—',
    decayPart: '—',
    riskNote: '同定できない子実体も腐朽進行の兆候として記録し、写真を残して専門家の同定につなげる。',
    source: '（運用ルール: 不明種の扱い）',
    verified: true
  }
];

// 樹種名からマスタを引く（部分一致も許容: 「クロマツ」→「マツ（クロマツ・アカマツ）」）
export function findSpeciesKnowledge(speciesName) {
  if (!speciesName) return null;
  const name = speciesName.trim();
  if (!name) return null;
  return (
    SPECIES_KNOWLEDGE.find((k) => k.species === name) ||
    SPECIES_KNOWLEDGE.find((k) => k.species.includes(name) || name.includes(k.species)) ||
    null
  );
}

// 腐朽菌名からマスタを引く
export function findFungusKnowledge(fungusName) {
  if (!fungusName) return null;
  const name = fungusName.trim();
  if (!name) return null;
  return (
    FUNGUS_KNOWLEDGE.find((k) => k.name === name) ||
    FUNGUS_KNOWLEDGE.find((k) => k.name.includes(name) || name.includes(k.name)) ||
    null
  );
}

// 記録用の腐朽菌選択肢（チェックボックス用）
export const FUNGUS_OPTIONS = FUNGUS_KNOWLEDGE.map((k) => k.name);
