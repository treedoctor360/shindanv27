// メール送信 — v26.8 の buildMailBody / sendMail を移植
// mailto: リンクでメールアプリを開く（添付はできないため、JSON/CSVは
// 先にダウンロードして手動添付する案内を本文に入れる。v26と同じ方式）。

/**
 * 記録の概要をメール本文として組み立てる（純粋関数）。
 * @param {Object[]} records
 * @param {{includeSummary?: boolean}} [opts]
 */
export function buildMailBody(records, opts = {}) {
  const { includeSummary = true } = opts;
  let body =
    `樹木点検データ 共有\n送信日：${new Date().toISOString().slice(0, 10)}\n` +
    `件数：${records.length}件\n\n${'━'.repeat(30)}\n`;
  if (includeSummary) {
    records.forEach((r, i) => {
      body +=
        `\n[${i + 1}] ${r.treeNo ?? ''} ${r.species ?? ''}\n` +
        `  調査日:${r.surveyDate ?? ''} 場所:${r.location ?? ''}\n` +
        `  点検者:${r.inspector ?? ''} 判定:${r.overall ?? ''}\n` +
        (r.comment ? `  所見:${r.comment}\n` : '');
    });
    body += '\n' + '━'.repeat(30) + '\n';
  }
  body +=
    '\n【添付ファイルについて】\n' +
    '詳細データが必要な場合は、アプリの「JSON書き出し」または「CSV」で\n' +
    'ダウンロードしたファイルを手動で添付してください。\n';
  return body + '\n--- 樹木診断・点検システム v27 ---';
}

/** メールアプリを開く */
export function openMailApp(to, subject, body) {
  window.location.href =
    `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}` +
    `&body=${encodeURIComponent(body)}`;
}
