import { describe, expect, it, vi } from 'vitest';
import { handleTick, type TickDeps } from './tick-handler';

const fullEnv = {
  CRON_SECRET: 's3cret',
  NEXT_PUBLIC_SUPABASE_URL: 'https://x.supabase.co',
  NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon-key',
  DSALES_WORKER_EMAIL: 'w@example.com',
  DSALES_WORKER_PASSWORD: 'pw-secret',
  JST_USER: 'jst-user',
  JST_PASSWORD: 'jst-pass',
  VERCEL_REGION: 'sin1',
};

function req(auth?: string): Request {
  return new Request('http://localhost/api/cron/outreach-tick', { method: 'POST', headers: auth ? { authorization: auth } : {} });
}

type MockDeps = {
  runTick: ReturnType<typeof vi.fn<TickDeps['runTick']>>;
  getQueue: ReturnType<typeof vi.fn<TickDeps['getQueue']>>;
};

function deps(out: Record<string, unknown> | Error): MockDeps {
  return {
    runTick: vi.fn<TickDeps['runTick']>(async () => {
      if (out instanceof Error) throw out;
      return out;
    }),
    getQueue: vi.fn<TickDeps['getQueue']>(() => ({ queue: true })),
  };
}

describe('handleTick', () => {
  it('rejects a missing or wrong bearer with 401 and touches nothing, even with incomplete env', async () => {
    const cases: Array<[string | undefined, Record<string, string | undefined>]> = [
      [undefined, fullEnv],
      ['Bearer wrong', fullEnv],
      ['Bearer s3cret', { CRON_SECRET: '' }],
      [undefined, {}],
    ];
    for (const [auth, env] of cases) {
      const d = deps({ skipped: null });
      const res = await handleTick(req(auth), env, d);
      expect(res.status).toBe(401);
      expect(res.headers.get('cache-control')).toBe('no-store');
      expect(await res.json()).toEqual({ error: 'unauthorized' });
      expect(d.getQueue).not.toHaveBeenCalled();
      expect(d.runTick).not.toHaveBeenCalled();
    }
  });

  it('returns 500 not_configured when the worker env is missing', async () => {
    const d = deps({ skipped: null });
    const env: Record<string, string | undefined> = { ...fullEnv, DSALES_WORKER_PASSWORD: undefined };
    const res = await handleTick(req('Bearer s3cret'), env, d);
    expect(res.status).toBe(500);
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect(await res.json()).toEqual({ ok: false, error: 'not_configured' });
    expect(d.getQueue).not.toHaveBeenCalled();
    expect(d.runTick).not.toHaveBeenCalled();
  });

  it('returns 200 with the tick output and no secrets', async () => {
    const d = deps({ skipped: null, result: 'sent', cookiesSaved: false });
    const res = await handleTick(req('Bearer s3cret'), fullEnv, d);
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('no-store');
    const body = await res.json();
    expect(body).toEqual({ ok: true, region: 'sin1', skipped: null, result: 'sent', cookiesSaved: false });
    const text = JSON.stringify(body);
    for (const secret of ['s3cret', 'pw-secret', 'jst-pass', 'anon-key', 'w@example.com']) expect(text).not.toContain(secret);
    const arg = d.runTick.mock.calls[0][0];
    expect(arg.workerId).toBe('vercel');
    expect(arg.jstConfig).toEqual({ accountId: 'jst-user', password: 'jst-pass', timeoutMs: 8000 });
  });

  it('returns 500 tick_failed with only the error name when runTick throws', async () => {
    const err = new TypeError('cookie=abc123 leaked');
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = await handleTick(req('Bearer s3cret'), fullEnv, deps(err));
    expect(res.status).toBe(500);
    expect(res.headers.get('cache-control')).toBe('no-store');
    const text = await res.text();
    expect(JSON.parse(text)).toEqual({ ok: false, error: 'tick_failed', kind: 'TypeError' });
    expect(text).not.toContain('abc123');
    expect(log.mock.calls.join(' ')).toContain('abc123'); // message stays in the log only
    log.mockRestore();
  });

  it('builds the queue client inside the try (getQueue throwing -> 500 tick_failed)', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    const d = deps({ skipped: null });
    d.getQueue.mockImplementation(() => {
      throw new Error('boom');
    });
    const res = await handleTick(req('Bearer s3cret'), fullEnv, d);
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ ok: false, error: 'tick_failed', kind: 'Error' });
    log.mockRestore();
  });

  it('returns 503 with ok:false when the tick ends in queue_error', async () => {
    const res = await handleTick(req('Bearer s3cret'), fullEnv, deps({ skipped: null, result: 'queue_error', cookiesSaved: false }));
    expect(res.status).toBe(503);
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect(await res.json()).toEqual({ ok: false, region: 'sin1', skipped: null, result: 'queue_error', cookiesSaved: false });
  });

  it('keeps skipped busy / needs_login / stopped at 200', async () => {
    for (const out of [{ skipped: 'busy' }, { skipped: null, result: 'needs_login' }, { skipped: null, result: 'stopped' }]) {
      const res = await handleTick(req('Bearer s3cret'), fullEnv, deps(out));
      expect(res.status).toBe(200);
      expect((await res.json()).ok).toBe(true);
    }
  });
});
