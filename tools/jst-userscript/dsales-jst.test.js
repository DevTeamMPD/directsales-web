// node --test tools/jst-userscript/dsales-jst.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const { parseHash, pickSession } = require('./dsales-jst.user.js');

test('parseHash reads the hash the Direct Sale web sends', () => {
  const h = '#dsales-chat=' + encodeURIComponent('😊😊A o m 😊😊') + '&dsales-ms=130427&dsales-t=5';
  assert.deepEqual(parseHash(h), { chat: '😊😊A o m 😊😊', search: '😊😊A o m 😊😊', ms: '130427' });
  assert.equal(parseHash('#foo=1'), null);
  assert.equal(parseHash(''), null);
  assert.equal(parseHash('#dsales-chat=x&dsales-ms=1;drop').ms, '');
});

test('parseHash cuts the search text to the 50 characters JST accepts (by code point)', () => {
  const long = '😊'.repeat(60);
  const r = parseHash('#dsales-chat=' + encodeURIComponent(long));
  assert.equal(Array.from(r.search).length, 50);
  assert.equal(r.chat, long);
});

test('pickSession: ms_id first, then a unique exact name, then a single result of a changed list', () => {
  const items = [{ ms: '1', name: 'Aom' }, { ms: '2', name: 'Aom ' }, { ms: '3', name: 'Bee' }];
  assert.equal(pickSession(items, { chat: 'Bee', ms: '2' }, false), 1);
  assert.equal(pickSession(items, { chat: 'Bee', ms: '' }, false), 2);
  assert.equal(pickSession(items, { chat: 'Aom', ms: '' }, true), -1); // สองห้องชื่อเดียวกัน → ให้เลือกเอง
  assert.equal(pickSession([{ ms: '9', name: 'Aom (LINE)' }], { chat: 'Aom', ms: '' }, true), 0);
  assert.equal(pickSession([{ ms: '9', name: 'Old' }], { chat: 'Aom', ms: '' }, false), -1); // รายการเก่ายังไม่เปลี่ยน
});
