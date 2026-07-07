// GPX出力（地図アプリ用）— v26.8 の exportToGPX を移植
// GPX = GPSデータ交換用のXML形式。スーパー地形・Googleマイマップ等で読み込める。
// 記録1件 = 1ウェイポイント（wpt）。位置情報のない記録は除外する。

import { dlBlob } from '../download.js';

const GRADE_TEXT = { A: '健全', B: '健全に近い', C: '要注意', D: '危険木' };
// 地図アプリの標準シンボル名（Garmin系）
const GRADE_SYM = { A: 'Flag, Green', B: 'Flag, Blue', C: 'Caution', D: 'Danger' };

function escXml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * records から GPX 1.1 の文字列を組み立てる（純粋関数）。
 * @param {Object[]} records - 出力対象（位置情報の無いものはここで除外）
 * @param {string} modeLabel - メタデータに入れる範囲名（例: 全件 / 判定Dのみ）
 * @returns {{gpx: string, count: number}}
 */
export function buildGpx(records, modeLabel) {
  const now = new Date().toISOString();
  const targets = (records ?? []).filter((r) => {
    const lat = parseFloat(r.latitude);
    const lon = parseFloat(r.longitude);
    return Number.isFinite(lat) && Number.isFinite(lon);
  });

  const wpts = targets
    .map((r) => {
      const lat = parseFloat(r.latitude);
      const lon = parseFloat(r.longitude);
      const name = escXml(r.treeNo || r.id);
      const desc = escXml(
        [
          `樹種: ${r.species || '不明'}`,
          `調査日: ${r.surveyDate || ''}`,
          `調査者: ${r.inspector || ''}`,
          `場所: ${r.location || ''}`,
          `樹高: ${r.treeHeight || ''}m  幹周: ${r.trunkGirth || ''}cm`,
          `総合判定: ${GRADE_TEXT[r.overall] || r.overall || ''}`,
          r.comment ? `所見: ${r.comment}` : '',
          r.measures?.length ? `措置: ${r.measures.join('、')}` : ''
        ]
          .filter(Boolean)
          .join(' | ')
      );
      return `  <wpt lat="${lat}" lon="${lon}">
    <name>${name}</name>
    <desc>${desc}</desc>
    <sym>${GRADE_SYM[r.overall] || 'Flag, Green'}</sym>
    <type>${escXml(r.overall || '')}</type>
    <time>${r.surveyDate ? r.surveyDate + 'T00:00:00Z' : now}</time>
  </wpt>`;
    })
    .join('\n');

  const gpx = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="樹木診断・点検システム" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata>
    <name>樹木点検データ（${escXml(modeLabel)}）</name>
    <desc>樹木診断・点検システム エクスポート（${targets.length}件 / ${escXml(modeLabel)}）</desc>
    <time>${now}</time>
  </metadata>
${wpts}
</gpx>`;
  return { gpx, count: targets.length };
}

/**
 * GPXファイルをダウンロードさせる。
 * @returns {number} 出力件数（0なら未出力）
 */
export function exportGpx(records, modeLabel) {
  const { gpx, count } = buildGpx(records, modeLabel);
  if (count === 0) return 0;
  dlBlob(
    new Blob([gpx], { type: 'application/gpx+xml;charset=utf-8;' }),
    `樹木点検_${modeLabel}_${new Date().toISOString().slice(0, 10)}.gpx`
  );
  return count;
}
