# CLAUDE.md — 樹木診断・点検システム v27（Vite + React 移行版）

最終更新: 2026-07-04
担当: Koh Kitsukawa（大津市公園緑地課 / 樹木医）

---

## 0. 概要

このドキュメントは、Claudeプロジェクト「①樹木診断システム」における開発方針をまとめたもの。
現行の単一HTML版（v26.8 / リポジトリ `v26.1shindan`）を **Vite + React** で作り直す。
主目的は2つ。

1. **土台の堅牢化** — データ喪失リスクと判定ロジックのDOM依存を解消する。
2. **成り立ての樹木医の診断補助** — 観察はできるが「所見の言語化」「次の一手の判断」で
   つまずく場面を、システムが肩代わりする。

現行版のデータ（診断record）は構造互換を保ち、インポート機能で移行する。実運用データは失わない。

**現状（2026-07-04時点）**: 7章「移行手順」のStep 1〜7まで実装済み。GitHub Pagesで
公開し、実機（スマホ）での動作確認も完了している。判定ロジック・活力度17項目／
健全度14項目・診断補助機能①〜③・クラウド同期（GAS/`gas/Code.gs`）まで動作する。
残る主な課題は `src/data/knowledge.js` マスタの出典裏取り（現状は全件 `verified: false`）。

このプロジェクト共通の「やり取りのルール」「差分修正の定義」「修正報告の簡潔化」は
指示テンプレート集の0章に準拠する（本ドキュメントでは8章に要点のみ再掲）。

---

## 1. 技術スタック（確定）

| 層 | 採用 | 役割 |
|---|---|---|
| ビルド | Vite | 開発サーバ＋本番ビルドの土台 |
| UI | React | 画面を部品（コンポーネント）単位で構成 |
| 状態管理 | Zustand | アプリ全体で共有するデータの置き場（軽量。Reduxより学習コスト低） |
| ローカルDB | Dexie.js | IndexedDB（ブラウザ内の大容量DB）を扱いやすくする薄いラッパー |
| 地図 | React-Leaflet | 現行Leafletを React流に書き直したもの |
| Excel出力 | SheetJS(xlsx) | 現行を継続 |
| PWA/オフライン | vite-plugin-pwa | 現行のService Worker（オフライン動作の仕組み）を置き換え |
| 同期 | GAS（`gas/Code.gs`） | スプレッドシート＋Driveを共有マスタとする双方向同期 |
| デプロイ | GitHub Pages | 現行を継続（Viteの `base` 設定を追加） |

> ライブラリの具体バージョンは、開発着手時に最新の現行推奨を確認してから確定する。
> ここでは方針の骨子のみ記載。

**採用しない**（検討済み・見送り）
- Supabase … 既存のGoogle環境（スプレッドシート＋Drive）を共有基盤として活かすため
- 写真AI連携（症状候補・樹種同定補助）… 今回のスコープ外

---

## 2. データ層設計

> 【2026-07-03 方針変更】当初の「オフライン優先・IndexedDBがマスタ」をやめ、
> **データの保存と共有のしやすさを優先**する。

### 2-1. クラウド共有マスタ + ローカル作業コピー
- **共有マスタ = スプレッドシート（診断record）＋ Drive（写真）**。GAS Webアプリ経由で読み書きする。
  - 案件ごとにシート1枚（シート名 = 案件名）。行 = record 1件（人が読める列＋復元用 `_json` 列）。
  - 写真は Drive「樹木診断写真/<案件名>/<recordId>__<連番>.jpg」。
  - GAS側スクリプトは `gas/Code.gs`（導入手順もファイル冒頭に記載）。
- **ローカル（Dexie/IndexedDB）は現場作業用の作業コピー**。電波のない現場でも入力でき、
  電波が戻ったら「☁️ 共有」でクラウドへ反映する。
- 同期の動き:
  - アプリを開く/更新するたびに自動でクラウドから record を取り込む（autoPull・非破壊マージ）。
  - 記録一覧の「☁️ 共有」「⬇️ 読込」で**案件ごと**にアップロード／ダウンロード（写真込み）。
  - 競合は `updatedAt`（更新日時）が新しい方を採用。案件指定の「⬇️ 読込」は
    クラウドの内容への置き換え（実行前に未共有変更の有無を確認ダイアログで警告）。

### 2-2. Dexie テーブル構成（案）
```
db.version(1).stores({
  records:  'id, treeNo, surveyDate, projectId, overall',  // 診断本体（写真は持たない）
  photos:   'recordId',   // { recordId, images: string[] }  通常写真＋位置写真
  projects: 'id',
  settings: 'key'         // GAS設定・圧縮設定などの単一値
});
```

### 2-3. record スキーマ（現行互換＋同期用フィールド）
現行 `collectData()` を踏襲。写真だけ別テーブルへ分離する。
```
{
  id, projectId, treeNo, surveyDate, weather, inspector,
  species, family, scientificName, nickname, location,
  treeHeight, trunkGirth, latitude, longitude,
  geoSource,           // 座標の入力経路（gps / manual / paste / map。表示用のみ）
  scores: {},          // 活力度 17項目（0〜4）
  health: {},          // 健全度 14項目（A〜D）
  fungus: [], fungusOther,
  comment, measures: [],
  avg, worstHealth, overall,
  inference: {},       // 推論入力タブの内容
  updatedAt,           // 保存のたびに更新（クラウド同期の競合解決に使用）
  _sentToGAS, _sentToGASAt
}
// 写真は photos テーブルに { recordId, images:[...] } として保存
// クラウド往復時は projectId でなく案件名で対応付ける（GAS側は名前がキー）
```

### 2-4. バックアップ導線の強化
- 起動時に「最終バックアップから◯日」を表示し、JSON書き出し／GAS同期を促す。
- JSON復元に **「追記マージ」モード** を追加（現行は全上書きのみ）。マージは id 一致で更新、
  未知の id は追加。上書き前に必ず確認ダイアログを出す。

---

## 3. 判定ロジック（DOM分離）

現行はDOM表示文字列を保存していた（ズレの温床）。**純粋関数**（入力→出力だけで完結する計算）に切り出す。

`src/logic/diagnosis.js`
```
// 活力度の平均評点（有効項目のみで平均）
calcDeclineAvg(scores, enabledIds) -> number | null

// 健全度の最悪グレード（A<B<C<D）
worstHealth(health) -> 'A'|'B'|'C'|'D'

// 総合判定（avg と worst から確定）
calcOverall(avg, worst) -> { grade, gradeText, declineLevel }
```

### 判定基準（出典に準拠）
**衰退度（活力度）平均評点の区分** — 一般財団法人 日本緑化センターの衰退度判定基準に準拠。
各項目の評価値合計を項目数で割った平均で判定する。

| 平均評点 | 区分 |
|---|---|
| < 0.8 | Ⅰ（良） |
| < 1.6 | Ⅱ（やや不良） |
| < 2.4 | Ⅲ（不良） |
| < 3.2 | Ⅳ（著しく不良） |
| ≧ 3.2 | Ⅴ（枯死寸前） |

**総合判定**（活力度と健全度のうち悪い方で確定）
- worst=D または avg≧3.2 → **D 危険木（緊急対応）**
- worst=C または avg≧2.4 → **C 要注意**
- worst=B または avg≧1.6 → **B 健全に近い（経過観察）**
- 上記以外 → **A 健全**

> 出典: 日本緑化センター 樹木診断（衰退度判定基準。0.8未満=良、3.2以上=枯死寸前）。
> UI・データとも、表示は必ずこの純粋関数の返り値を映すだけにする。

---

## 4. 診断補助機能（①〜③）

すべて record を入力とする純粋関数＋表示部品として実装。データ構造は汚さない。

### ① 所見の言語化（最優先）
`src/logic/findings.js` の `generateFindings(record)` が判定根拠を文章化する。
- 総合判定Dなら「Dを決定づけた健全度項目」＋「活力度で評点の高い（悪い）上位項目」を明示。
- 出力を所見欄に「ドラフト挿入」するボタンを置く。報告書作成の心理的ハードルを下げる。

### ② 外観診断 → 精密診断への誘導
- 健全度で **子実体（キノコ）・開口空洞・腐朽部露出** が入力されたら警告バナーを自動表示。
- 文言例:「外観所見あり。機器診断（打音／貫入抵抗／レジストグラフ等）の要否を検討してください」。
- 根拠: 腐朽は外観に現れなくても内部で進行している場合が多く、外観診断だけで完結させないため。

### ③ 樹種・腐朽菌からの知識サジェスト
- `src/data/knowledge.js` に樹種マスタ・腐朽菌マスタをJSONで保持。
- 樹種選択時に頻出病虫害、記録した腐朽菌から材質腐朽の部位・倒木リスクの目安を表示。
- **内容の事実は日本緑化センター・日本樹木医会・樹木医学会等の公的資料で裏取りしてから登録する。**
  出典不明のまとめサイトは使わない。マスタの各項目に出典フィールドを持たせる。

（補助）同一 treeNo の経年比較 — 活力度平均のトレンドを可視化し、悪化傾向を検知。

---

## 5. フォルダ構成（案）

```
tree-shindan-v27/
├─ index.html
├─ vite.config.js          # base設定・PWA
├─ CLAUDE.md
├─ public/
└─ src/
   ├─ main.jsx
   ├─ App.jsx
   ├─ db/db.js             # Dexie定義・マイグレーション
   ├─ store/useRecordStore.js   # Zustand
   ├─ logic/
   │   ├─ diagnosis.js     # calcOverall 等（判定・DOM非依存）
   │   └─ findings.js      # generateFindings（機能①）
   ├─ data/
   │   ├─ declineItems.js  # 活力度17項目
   │   ├─ healthItems.js   # 健全度14項目
   │   └─ knowledge.js     # 機能③ マスタ（出典付き）
   ├─ components/
   │   ├─ InspectForm/     # 点検入力
   │   ├─ RecordList/      # 記録一覧
   │   ├─ MapView/         # React-Leaflet
   │   └─ InferencePanel/  # 推論入力
   ├─ features/
   │   ├─ excel/           # SheetJS出力
   │   ├─ gas/             # GAS同期
   │   └─ import/          # 旧localStorageデータ取込
   └─ styles/
```

---

## 6. 移行手順（実装順）

1. Vite+React の骨組みを立てる
2. **データ層（Dexie）＋判定純粋関数** を先に作る（ここが土台）
3. **旧データのインポート関数**を実装（現行版でJSON書き出し → v27で取り込み）
4. 点検入力フォーム → 記録一覧 → 地図 を移植
5. Excel出力・GAS同期を移植
6. 機能①→②→③を追加
7. PWA化 → GitHub Pages デプロイ（`base` 設定に注意）

---

## 7. 開発の始め方（ローカル）

> 実行時に Node のバージョン要件と `create vite` の最新の対話フローを確認すること。

```bash
# 1. プロジェクト作成（React + JavaScript を選択）
npm create vite@latest tree-shindan-v27
cd tree-shindan-v27

# 2. 依存を入れる
npm install
npm install dexie zustand leaflet react-leaflet xlsx
npm install -D vite-plugin-pwa

# 3. 開発サーバ起動
npm run dev
```
その後、この CLAUDE.md をリポジトリ直下に置き、`src/db/db.js` と
`src/logic/diagnosis.js` から着手する。

---

## 8. コーディング方針（全プロジェクト共通ルール）

- UIは日本語、コード内コメントも日本語でよい。
- 後から自分で読めるコードを優先。過度な抽象化は避ける。
- **差分修正の意味は「無関係な箇所を書き換えない」こと**。1件の依頼（1機能追加・
  1バグ修正）に伴う複数箇所の連動修正はまとめて実施してよい。事前合意が必要なのは
  「設計変更」「大幅な書き換え」のみ。指示外の箇所は勝手に触らない。
- **修正報告は簡潔に**：構文チェック・テストの結果は、問題がなければ一言で報告する
  （例:「npm test OK」）。問題があった場合のみ、原因・修正内容を詳しく説明する。
- プログラミング用語は初出時に日本語の補足を入れる。
- Claude Code のターミナル操作は省略せず毎回手順を明示する。
- 事実と推定を分ける。検索可能な事実は公的資料で裏取りしてから記載する。
- フッターに著作権表記を入れる。

---

## 9. 実装メモ（v27 初期実装時の注意点）

- **項目キー・項目名・評点文言は v26.1shindan のソースと照合済み（全項目確定）。**
  v26 は英語名キー（`fungusBody`, `sprout` 等）を使っており、v27 も同じキーを
  正式IDとして採用した（`SCORE_KEY_MAP` / `HEALTH_KEY_MAP` は空でよい）。
  - 活力度17項目（`src/data/declineItems.js`）: v26 の `declineItems` を
    そのまま採用。各項目の `desc`（評点0〜4の説明文）はボタン入力のラベルに使う。
  - 健全度14項目（`src/data/healthItems.js`）: v26 の `healthItems` を採用。
    項目ごとに使わないグレード（v26 の `inactive`／「該当なし」）は除外し、
    `grades` に「実際に選べるグレードと説明文」だけを持たせている。
  - 取り込み時の平均再計算は「record に実在する評点キー」で行うため、
    マスタ外のキーが来ても平均値は v26 と一致する。
- **入力UIはプルダウンでなくボタン**（`ButtonGroup.jsx`）。天候・活力度・
  健全度・案件選択をボタン化。現場でのタップ操作を優先。
- **案件（プロジェクト）**は Dexie `projects` テーブルに保存。設定タブで登録し、
  点検入力タブ上部のバーで選択、`record.projectId` に紐づく。
- **位置の微修正**: GPS取得後、`LocationPicker.jsx` の地図でピンをドラッグ
  またはタップして緯度経度を調整できる。
- **座標の登録経路は4つ**（`GeoField.jsx` + `src/logic/geo.js`）。現地では「📍 現在地を入れる」
  （GPS）、後日デスクで登録する時は緯度経度の手入力、または **Googleマップのリンク／緯度経度ペア
  ／度分秒の貼り付け → 「読み取り」**、加えて地図のピン操作。座標が入っていれば「地図で確認」で
  Googleマップを別タブで開ける。パース処理は `parseLatLng()` に閉じており `npm test` で検証する。
  短縮リンク（maps.app.goo.gl）はブラウザから展開できない（CORS）ため、その旨を案内する。
- **knowledge.js のマスタは全件 `verified: false`（出典確認中）で登録済み。**
  公的資料の原典ページと照合してから `verified: true` に変更すること。
- 判定テストは `npm test`（node --test）で実行できる。
- PWAアイコンは `node scripts/gen-icons.mjs` で再生成できる。
- GitHub Pages のパスは `vite.config.js` の `base: '/shindanv27/'`。
  リポジトリ名を変えた場合はここも変える。

---

© 2026 Koh Kitsukawa. All rights reserved.
