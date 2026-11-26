import { describe, expect, it } from 'vitest';
import { actorOf, canUnclaimAs, effectiveViewAs, readStoredViewAs, VIEW_AS_STORAGE_KEY, viewAsOptions, writeStoredViewAs } from './viewAs';

const reps = [
  { id: 'admin', name: 'Dev MPD', initials: 'DM', role: 'admin' as const, active: true },
  { id: 's1', name: 'kanittha.c', initials: 'KC', role: 'sales' as const, active: true },
  { id: 's2', name: 'pattamawan.p', initials: 'PP', role: 'sales' as const, active: false },
];
const kv = (init: Record<string, string> = {}) => {
  const m = new Map(Object.entries(init));
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), m };
};

describe('admin view-as-rep mode', () => {
  it('storage round trip; unreadable storage = team view', () => {
    const s = kv();
    expect(readStoredViewAs(s)).toBeNull();
    writeStoredViewAs(s, 's1');
    expect(s.m.get(VIEW_AS_STORAGE_KEY)).toBe('s1');
    expect(readStoredViewAs(s)).toBe('s1');
    writeStoredViewAs(s, null);
    expect(readStoredViewAs(s)).toBeNull();
    expect(readStoredViewAs({ getItem: () => { throw new Error('denied'); }, setItem: () => {} })).toBeNull();
  });
  it('only admins keep a view-as, and only for another active member', () => {
    expect(effectiveViewAs('s1', true, reps, 'admin')).toBe('s1');
    expect(effectiveViewAs('s1', false, reps, 's9')).toBeNull();
    expect(effectiveViewAs('s2', true, reps, 'admin')).toBeNull();
    expect(effectiveViewAs('admin', true, reps, 'admin')).toBeNull();
    expect(effectiveViewAs('ghost', true, reps, 'admin')).toBeNull();
  });
  it('options list active members except me; actor is the rep in view-as mode', () => {
    expect(viewAsOptions(reps, 'admin')).toEqual([{ value: 's1', label: 'kanittha.c' }]);
    expect(actorOf('admin', null)).toEqual({ actorId: 'admin', forUser: null });
    expect(actorOf('admin', 's1')).toEqual({ actorId: 's1', forUser: 's1' });
  });
  it('admins can hand back any owned, not-won, not no-call lead; reps only their own claims', () => {
    const l = (over = {}) => ({ owner: 's1', claimedBy: 's1', noCall: false, status: 'following' as const, ...over });
    expect(canUnclaimAs(l(), 'admin', true)).toBe(true);
    expect(canUnclaimAs(l({ status: 'won' as const }), 'admin', true)).toBe(false);
    expect(canUnclaimAs(l({ noCall: true }), 'admin', true)).toBe(false);
    expect(canUnclaimAs(l({ owner: null }), 'admin', true)).toBe(false);
    expect(canUnclaimAs(l(), 's1', false)).toBe(true);
    expect(canUnclaimAs(l(), 's2', false)).toBe(false);
    expect(canUnclaimAs(l({ claimedBy: 'admin' }), 's1', false)).toBe(false);
  });
});
