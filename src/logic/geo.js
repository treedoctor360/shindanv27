// 座標の解釈と整形（DOM非依存の純粋関数）。
// GPSが使えない場面でも位置を登録できるようにするための入口。
// 想定する貼り付け元:
//   - Googleマップのリンク（アドレスバーのURL）
//   - 「35.011600, 135.768100」のような緯度経度ペア
//   - 度分秒表記「35°00'41.8"N 135°46'05.2"E」

export const isValidLat = (v) => Number.isFinite(v) && v >= -90 && v <= 90;
export const isValidLng = (v) => Number.isFinite(v) && v >= -180 && v <= 180;

// 表示用に桁を丸める。末尾の余分な0は落とす（35.012000 → 35.012）。
export function formatCoord(v, digits = 6) {
  // 空文字は Number('') === 0 になってしまうため、数値化する前に弾く
  if (v == null || String(v).trim() === '') return '';
  const n = Number(v);
  if (!Number.isFinite(n)) return '';
  return String(Number(n.toFixed(digits)));
}

export function formatLatLng(lat, lng, digits = 6) {
  const a = formatCoord(lat, digits);
  const b = formatCoord(lng, digits);
  return a && b ? `${a}, ${b}` : '';
}

// 座標を地図で目視確認するためのGoogleマップURL。
export function mapUrl(lat, lng) {
  return `https://www.google.com/maps?q=${formatCoord(lat)},${formatCoord(lng)}`;
}

const num = (s) => Number(String(s).trim());

// 度分秒（35°00'41.8"N / N35°00'41.8" …）。全角の「度分秒」やプライム記号にも対応。
// 半球記号（N/S/E/W）は空白を挟まず隣接している側の座標に属するとみなす。
// そのため末尾側（グループ5）の前には \s* を置かない。これを許すと
// 「E135°46'05.2" N35°00'41.8"」の N を1つ目の末尾記号として食ってしまう。
const DMS_RE = /([NSEW])?\s*(\d{1,3})\s*[°度]\s*(\d{1,2})\s*[′'’分]\s*([\d.]+)\s*[″"”秒]?([NSEW])?/gi;

function dmsToDeg(d, m, s, hemi) {
  const v = Math.abs(d) + m / 60 + s / 3600;
  return /[SW]/i.test(hemi || '') ? -v : v;
}

function parseDms(text) {
  const hits = [...String(text).matchAll(DMS_RE)];
  if (hits.length < 2) return null;
  const vals = hits.slice(0, 2).map((h) => {
    const hemi = h[1] || h[5] || '';
    return { deg: dmsToDeg(num(h[2]), num(h[3]), num(h[4]), hemi), hemi: hemi.toUpperCase() };
  });
  // 半球記号（N/S/E/W）があればそれで緯度・経度を決める。無ければ「緯度→経度」の順とみなす。
  const lat = vals.find((v) => v.hemi === 'N' || v.hemi === 'S') || vals[0];
  let lng = vals.find((v) => v.hemi === 'E' || v.hemi === 'W');
  // 緯度に選んだものと同じになった場合（記号が片方しか無い等）は残りを経度にする
  if (!lng || lng === lat) lng = vals.find((v) => v !== lat);
  if (!lat || !lng) return null;
  return { lat: lat.deg, lng: lng.deg };
}

// URLから座標を拾う。優先度: 明示クエリ(q/ll等) > ピン位置(!3d!4d) > 表示中心(@)
// 表示中心(@)は「地図の中心」であってピンとは限らないため最後に見る。
function parseUrl(text) {
  const s = String(text);
  const pairs = [
    /[?&](?:q|ll|center|daddr|saddr|sll|mlat)=(-?\d{1,3}(?:\.\d+)?)[,%2C]+\s*(-?\d{1,3}(?:\.\d+)?)/i,
    /!3d(-?\d{1,3}(?:\.\d+)?)!4d(-?\d{1,3}(?:\.\d+)?)/,
    /@(-?\d{1,3}(?:\.\d+)?),(-?\d{1,3}(?:\.\d+)?)/
  ];
  for (const re of pairs) {
    const m = s.match(re);
    if (m) return { lat: num(m[1]), lng: num(m[2]) };
  }
  return null;
}

// 「35.0116, 135.7681」「35.0116/135.7681」「35.0116 135.7681」
function parseDecimalPair(text) {
  const m = String(text).match(/(-?\d{1,3}(?:\.\d+)?)\s*[,、/\s]\s*(-?\d{1,3}(?:\.\d+)?)/);
  return m ? { lat: num(m[1]), lng: num(m[2]) } : null;
}

/**
 * 座標らしき文字列を解釈する。Googleマップのリンク／緯度経度ペア／度分秒に対応。
 * @param {string} text
 * @returns {{ok:true, lat:number, lng:number} | {ok:false, reason:string}}
 */
export function parseLatLng(text) {
  const s = String(text || '').trim();
  if (!s) return { ok: false, reason: '座標が入力されていません。' };
  // 短縮URLはブラウザからリダイレクト先を読めない（CORS制限）。展開後のURLを貼ってもらう。
  if (/(maps\.app\.goo\.gl|goo\.gl\/maps)/i.test(s)) {
    return {
      ok: false,
      reason:
        '短縮リンクは展開できません。マップで開き直して、アドレスバーのURLか緯度経度を貼り付けてください。'
    };
  }
  const hit =
    (/https?:\/\//i.test(s) ? parseUrl(s) : null) || parseDms(s) || parseUrl(s) || parseDecimalPair(s);
  if (!hit) {
    return {
      ok: false,
      reason: '座標を読み取れませんでした（例: 35.011600, 135.768100 / Googleマップのリンク）。'
    };
  }
  if (!isValidLat(hit.lat) || !isValidLng(hit.lng)) {
    return {
      ok: false,
      reason:
        '数値が範囲外です（緯度 -90〜90、経度 -180〜180）。緯度と経度が逆になっていないか確認してください。'
    };
  }
  return { ok: true, lat: hit.lat, lng: hit.lng };
}
