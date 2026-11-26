// node --test
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { cleanCookies, fileStore, memoryStore } from './session-store.mjs';

test('cleanCookies keeps only {name, value} string pairs', () => {
  assert.deepEqual(cleanCookies([{ name: 'a', value: '1', path: '/' }, { name: 'b' }, null, 'x']), [{ name: 'a', value: '1' }]);
  assert.deepEqual(cleanCookies('nope'), []);
});

test('fileStore: missing file loads empty; save writes JSON and bumps mtime', () => {
  const path = join(mkdtempSync(join(tmpdir(), 'jsts-')), '.session.json');
  const s = fileStore(path);
  assert.deepEqual(s.load(), []);
  assert.equal(s.mtime(), 0);
  s.save([{ name: 'a', value: '1' }]);
  assert.deepEqual(JSON.parse(readFileSync(path, 'utf8')), [{ name: 'a', value: '1' }]);
  assert.ok(s.mtime() > 0);
  assert.equal(existsSync(`${path}.tmp`), false);
  writeFileSync(path, 'not json');
  assert.deepEqual(s.load(), []);
});

test('memoryStore: starts clean, becomes dirty on save, hands out copies', () => {
  const s = memoryStore([{ name: 'a', value: '1', extra: true }]);
  assert.equal(s.dirty, false);
  assert.deepEqual(s.load(), [{ name: 'a', value: '1' }]);
  s.load()[0].value = 'changed';
  assert.deepEqual(s.cookies(), [{ name: 'a', value: '1' }]);
  s.save([{ name: 'a', value: '2' }]);
  assert.equal(s.dirty, true);
  assert.deepEqual(s.cookies(), [{ name: 'a', value: '2' }]);
  assert.equal(s.mtime(), 0);
});

test('memoryStore: saving identical cookies does not mark dirty', () => {
  const s = memoryStore([{ name: 'a', value: '1' }]);
  s.save([{ name: 'a', value: '1', path: '/' }]);
  assert.equal(s.dirty, false);
});
