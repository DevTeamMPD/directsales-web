import { describe, expect, it } from 'vitest';
import { classifySession } from './session';

const offline = { name: 'AuthRetryableFetchError', message: 'Failed to fetch', status: 0 };

describe('classifySession (AppProvider loadLive)', () => {
  it('a signed-in user continues', () => {
    expect(classifySession({ hasSession: true, sessionError: null, user: { id: 'u1', email: 'a@example.com' }, userError: null }))
      .toEqual({ kind: 'user', email: 'a@example.com' });
  });
  it('no session at all → /login', () => {
    expect(classifySession({ hasSession: false, sessionError: null, user: null, userError: null })).toEqual({ kind: 'login' });
  });
  it('AuthSessionMissingError → /login', () => {
    const missing = { name: 'AuthSessionMissingError', message: 'Auth session missing!', status: 400 };
    expect(classifySession({ hasSession: true, sessionError: null, user: null, userError: missing })).toEqual({ kind: 'login' });
  });
  it('network failures never redirect (would loop with the middleware) — show the error card', () => {
    expect(classifySession({ hasSession: true, sessionError: null, user: null, userError: offline }))
      .toEqual({ kind: 'error', message: 'Failed to fetch' });
    expect(classifySession({ hasSession: false, sessionError: offline, user: null, userError: null }))
      .toEqual({ kind: 'error', message: 'Failed to fetch' });
  });
});
