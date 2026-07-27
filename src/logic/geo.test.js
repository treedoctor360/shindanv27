// 座標パースのテスト（node --test で実行: npm test）
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseLatLng, formatCoord, formatLatLng, mapUrl, isValidLat, isValidLng } from './geo.js';

const near = (a, b, tol = 1e-4) => Math.abs(a - b) < tol;

test('parseLatLng: 緯度経度ペア（カンマ・スラッシュ・空白）', () => {
  for (const s of ['35.0116, 135.7681', '35.0116/135.7681', '35.0116 135.7681', '35.0116、135.7681']) {
    const r = parseLatLng(s);
    assert.equal(r.ok, true, s);
    assert.ok(near(r.lat, 35.0116) && near(r.lng, 135.7681), s);
  }
});

test('parseLatLng: Googleマップのリンク（q= / @ / !3d!4d）', () => {
  const q = parseLatLng('https://www.google.com/maps?q=35.011600,135.768100');
  assert.ok(q.ok && near(q.lat, 35.0116) && near(q.lng, 135.7681));

  const at = parseLatLng('https://www.google.com/maps/@35.0116,135.7681,18z');
  assert.ok(at.ok && near(at.lat, 35.0116) && near(at.lng, 135.7681));

  // ピン位置(!3d!4d)は表示中心(@)より優先する
  const pin = parseLatLng(
    'https://www.google.com/maps/place/X/@35.0000,135.0000,17z/data=!3m1!4b1!4m5!3d35.0116!4d135.7681'
  );
  assert.ok(pin.ok && near(pin.lat, 35.0116) && near(pin.lng, 135.7681));
});

test('parseLatLng: 度分秒（半球記号あり・順序が逆でも緯経を判別）', () => {
  const a = parseLatLng('35°00\'41.8"N 135°46\'05.2"E');
  assert.ok(a.ok && near(a.lat, 35.0116) && near(a.lng, 135.768111));

  const b = parseLatLng('E135°46\'05.2" N35°00\'41.8"');
  assert.ok(b.ok && near(b.lat, 35.0116) && near(b.lng, 135.768111));

  const s = parseLatLng('35°00\'41.8"S 135°46\'05.2"W');
  assert.ok(s.ok && near(s.lat, -35.0116) && near(s.lng, -135.768111));
});

test('parseLatLng: 度のみ（日本語の方角）', () => {
  for (const s of [
    '北35.01394°, 東135.85369°',
    '北緯35.01394度 東経135.85369度',
    '北緯 35.01394度、東経 135.85369度'
  ]) {
    const r = parseLatLng(s);
    assert.equal(r.ok, true, s);
    assert.ok(near(r.lat, 35.01394) && near(r.lng, 135.85369), s);
  }
});

test('parseLatLng: 度のみ（英字・度記号のみ）', () => {
  for (const s of ['35.01394°N, 135.85369°E', 'N35.01394 E135.85369', '35.01394°, 135.85369°']) {
    const r = parseLatLng(s);
    assert.equal(r.ok, true, s);
    assert.ok(near(r.lat, 35.01394) && near(r.lng, 135.85369), s);
  }
});

test('parseLatLng: 度のみ（南緯・西経は負値）', () => {
  const r = parseLatLng('南35.01394°, 西135.85369°');
  assert.ok(r.ok && near(r.lat, -35.01394) && near(r.lng, -135.85369));
});

test('parseLatLng: 度のみ でも桁を丸めない', () => {
  const r = parseLatLng('北35.01776443639602°, 東135.85462927807734°');
  assert.equal(r.ok, true);
  assert.equal(r.lat, 35.01776443639602);
  assert.equal(r.lng, 135.85462927807734);
});

test('parseLatLng: 度のみ の追加で度分秒・URLが壊れていない', () => {
  // 度分秒（分秒を含むものは parseDms が処理する）
  const dms = parseLatLng('35°00\'41.8"N 135°46\'05.2"E');
  assert.ok(dms.ok && near(dms.lat, 35.0116) && near(dms.lng, 135.768111));

  // 小文字を拾わないこと（URL中の google の e などを半球記号と誤認しない）
  const url = parseLatLng('https://www.google.com/maps?q=35.011600,135.768100');
  assert.ok(url.ok && near(url.lat, 35.0116) && near(url.lng, 135.7681));

  const pin = parseLatLng(
    'https://www.google.com/maps/place/X/@35.0000,135.0000,17z/data=!3m1!4b1!4m5!3d35.0116!4d135.7681'
  );
  assert.ok(pin.ok && near(pin.lat, 35.0116) && near(pin.lng, 135.7681));

  // 記号なしの数値ペアは従来どおり parseDecimalPair が処理する
  const plain = parseLatLng('35.0116, 135.7681');
  assert.ok(plain.ok && near(plain.lat, 35.0116) && near(plain.lng, 135.7681));
});

test('parseLatLng: 短縮リンクは読めない旨を返す', () => {
  const r = parseLatLng('https://maps.app.goo.gl/abcdefg');
  assert.equal(r.ok, false);
  assert.match(r.reason, /短縮リンク/);
});

test('parseLatLng: 空文字・読み取り不能・範囲外', () => {
  assert.equal(parseLatLng('').ok, false);
  assert.equal(parseLatLng('   ').ok, false);
  assert.equal(parseLatLng('現地の大きなケヤキ').ok, false);
  // 緯度と経度が逆（緯度に135）→ 範囲外として弾く
  const swapped = parseLatLng('135.768100, 35.011600');
  assert.equal(swapped.ok, false);
  assert.match(swapped.reason, /範囲外/);
  assert.equal(parseLatLng('95.0000, 200.0000').ok, false);
});

test('formatCoord / formatLatLng / mapUrl', () => {
  assert.equal(formatCoord(35.0120000), '35.012');
  assert.equal(formatCoord(''), '');
  assert.equal(formatLatLng(35.0116, 135.7681), '35.0116, 135.7681');
  assert.equal(formatLatLng('', 135.7681), '');
  assert.equal(mapUrl(35.0116, 135.7681), 'https://www.google.com/maps?q=35.0116,135.7681');
});

test('isValidLat / isValidLng', () => {
  assert.equal(isValidLat(35), true);
  assert.equal(isValidLat(90.1), false);
  assert.equal(isValidLng(180), true);
  assert.equal(isValidLng(-180.1), false);
  assert.equal(isValidLat(NaN), false);
});
