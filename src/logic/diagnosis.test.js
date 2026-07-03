// 判定ロジックのテスト（node --test で実行: npm test）
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  calcDeclineAvg,
  declineLevelFromAvg,
  worstHealth,
  calcOverall
} from './diagnosis.js';

test('calcDeclineAvg: 有効項目のみで平均する', () => {
  const scores = { d01: 2, d02: 4, d03: '', d04: null, d99: 4 };
  // d99 は enabledIds に含めないので無視される
  assert.equal(calcDeclineAvg(scores, ['d01', 'd02', 'd03', 'd04']), 3);
});

test('calcDeclineAvg: 全未入力なら null', () => {
  assert.equal(calcDeclineAvg({}, ['d01', 'd02']), null);
  assert.equal(calcDeclineAvg({ d01: '' }, ['d01']), null);
});

test('calcDeclineAvg: 文字列の数値も受け付ける（旧データ互換）', () => {
  assert.equal(calcDeclineAvg({ d01: '3', d02: '1' }, ['d01', 'd02']), 2);
});

test('declineLevelFromAvg: 境界値（日本緑化センター基準）', () => {
  assert.equal(declineLevelFromAvg(0).level, 'Ⅰ');
  assert.equal(declineLevelFromAvg(0.79).level, 'Ⅰ');
  assert.equal(declineLevelFromAvg(0.8).level, 'Ⅱ');
  assert.equal(declineLevelFromAvg(1.6).level, 'Ⅲ');
  assert.equal(declineLevelFromAvg(2.4).level, 'Ⅳ');
  assert.equal(declineLevelFromAvg(3.2).level, 'Ⅴ');
  assert.equal(declineLevelFromAvg(4).level, 'Ⅴ');
  assert.equal(declineLevelFromAvg(null), null);
});

test('worstHealth: 最悪グレードを返す', () => {
  assert.equal(worstHealth({ h01: 'A', h02: 'C', h03: 'B' }), 'C');
  assert.equal(worstHealth({ h01: 'D', h02: 'A' }), 'D');
  assert.equal(worstHealth({}), null);
  assert.equal(worstHealth({ h01: '' }), null);
});

test('calcOverall: 悪い方で確定する', () => {
  // 健全度Dなら活力度が良くてもD
  assert.equal(calcOverall(0.5, 'D').grade, 'D');
  // avg≧3.2 なら健全度Aでも D
  assert.equal(calcOverall(3.2, 'A').grade, 'D');
  // worst=C
  assert.equal(calcOverall(0.5, 'C').grade, 'C');
  // avg≧2.4
  assert.equal(calcOverall(2.4, 'A').grade, 'C');
  // worst=B
  assert.equal(calcOverall(0.5, 'B').grade, 'B');
  // avg≧1.6
  assert.equal(calcOverall(1.6, 'A').grade, 'B');
  // どちらも良好なら A
  assert.equal(calcOverall(0.5, 'A').grade, 'A');
});

test('calcOverall: 片方だけの入力でも判定できる', () => {
  assert.equal(calcOverall(null, 'C').grade, 'C');
  assert.equal(calcOverall(2.5, null).grade, 'C');
  assert.equal(calcOverall(null, null), null);
});

test('calcOverall: declineLevel を含む', () => {
  const r = calcOverall(2.5, 'A');
  assert.equal(r.declineLevel, 'Ⅳ');
  assert.equal(calcOverall(null, 'B').declineLevel, null);
});
