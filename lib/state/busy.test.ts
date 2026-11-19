import { describe, expect, it } from 'vitest';
import { createBusyGuard } from './busy';

const deferred = () => {
  let resolve!: (v: string) => void;
  let reject!: (e: Error) => void;
  const promise = new Promise<string>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

describe('createBusyGuard', () => {
  it('runs one call per key at a time; a second click while waiting does nothing', async () => {
    const g = createBusyGuard();
    const d = deferred();
    let calls = 0;
    const first = g.run('claim:L1', () => {
      calls += 1;
      return d.promise;
    });
    const second = g.run('claim:L1', async () => {
      calls += 1;
      return 'x';
    });
    expect(g.has('claim:L1')).toBe(true);
    await expect(second).resolves.toBeUndefined();
    d.resolve('ok');
    await expect(first).resolves.toBe('ok');
    expect(calls).toBe(1);
    expect(g.has('claim:L1')).toBe(false);
  });
  it('different keys run in parallel', async () => {
    const g = createBusyGuard();
    const a = deferred();
    const p1 = g.run('claim:L1', () => a.promise);
    await expect(g.run('claim:L2', async () => 'b')).resolves.toBe('b');
    a.resolve('a');
    await expect(p1).resolves.toBe('a');
  });
  it('releases the key when the call fails, and rethrows', async () => {
    const g = createBusyGuard();
    await expect(g.run('assign:L1', async () => { throw new Error('taken'); })).rejects.toThrow('taken');
    await expect(g.run('assign:L1', async () => 'again')).resolves.toBe('again');
  });
});
