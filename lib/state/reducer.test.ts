import { describe, expect, it } from 'vitest';
import { leadJson } from '@/lib/api/test-helpers';
import type { Campaign } from '@/lib/api/types';
import { initialState, reducer, type AppState, type LoadedPayload } from './reducer';

const payload: LoadedPayload = {
  email: 'a@example.com', meId: 'u1', isAdmin: true, live: true, reps: [{ id: 'u1', name: 'Dev MPD', initials: 'DE', role: 'admin' }],
  campaigns: [], leads: [], customers: [], today: '2026-11-04',
};
const ready: AppState = reducer(initialState, { type: 'loaded', payload });

describe('reducer', () => {
  it('loaded → ready with the loaded data', () => {
    expect(ready).toMatchObject({ phase: 'ready', meId: 'u1', isAdmin: true, today: '2026-11-04', error: '' });
  });
  it('noAccess clears data and remembers the email', () => {
    expect(reducer(ready, { type: 'noAccess', email: 'x@example.com', inactive: false }))
      .toMatchObject({ phase: 'no-access', email: 'x@example.com', reps: [], isAdmin: false });
    expect(reducer(ready, { type: 'noAccess', email: 'x@example.com', inactive: true }).phase).toBe('inactive');
  });
  it('failed keeps the message', () => {
    expect(reducer(initialState, { type: 'failed', error: 'โหลดข้อมูลจาก Supabase ไม่สำเร็จ: boom' }))
      .toMatchObject({ phase: 'error', error: 'โหลดข้อมูลจาก Supabase ไม่สำเร็จ: boom' });
  });
  it('upsertLead / patchLead / removeLead update the lead list', () => {
    let s = reducer(ready, { type: 'upsertLead', lead: leadJson({ id: 'L1' }) });
    s = reducer(s, { type: 'patchLead', id: 'L1', patch: { purchases: [{ date: '2026-10-01', bill: '1', sku: 'S', product: 'P', amount: 1, seller: null }] } });
    s = reducer(s, { type: 'upsertLead', lead: leadJson({ id: 'L1', status: 'won' }) });
    expect(s.leads).toHaveLength(1);
    expect(s.leads[0].status).toBe('won');
    expect(s.leads[0].purchases).toHaveLength(1);
    expect(reducer(s, { type: 'removeLead', id: 'L1' }).leads).toEqual([]);
  });
  it('setUi merges filters; upsertCampaign inserts then replaces', () => {
    const s = reducer(initialState, { type: 'setUi', patch: { q: 'สุภาพร', status: 'won' } });
    expect(s.ui).toMatchObject({ q: 'สุภาพร', status: 'won', sort: 'due', period: { from: '', to: '', key: 'all' } });
    const c: Campaign = { id: 'c1', brand: 'bebeplay', name: 'A', note: '', start: '', end: '', claimMode: 'self', maxPerRep: null, active: true, criteria: [] };
    const s2 = reducer(reducer(s, { type: 'upsertCampaign', campaign: c }), { type: 'upsertCampaign', campaign: { ...c, name: 'B' } });
    expect(s2.campaigns).toEqual([{ ...c, name: 'B' }]);
  });
  it('failed after ready is ignored — errors while using a page go to the toast', () => {
    expect(reducer(ready, { type: 'failed', error: 'boom' })).toBe(ready);
  });
  it('sessionLost clears every lead and customer, keeps the email, and only applies once ready', () => {
    const withLead = reducer(ready, { type: 'upsertLead', lead: leadJson({ id: 'L1' }) });
    expect(reducer(withLead, { type: 'sessionLost', reason: 'expired' }))
      .toMatchObject({ phase: 'expired', email: 'a@example.com', leads: [], reps: [], customers: [], isAdmin: false });
    expect(reducer(withLead, { type: 'sessionLost', reason: 'inactive' }).phase).toBe('inactive');
    expect(reducer(initialState, { type: 'sessionLost', reason: 'expired' })).toBe(initialState);
  });
  it('setToday moves to the new Bangkok day and ignores the same day', () => {
    expect(reducer(ready, { type: 'setToday', today: '2026-11-04' })).toBe(ready);
    expect(reducer(ready, { type: 'setToday', today: '2026-11-05' }).today).toBe('2026-11-05');
  });
  it('setPool merges the persistent pool filters', () => {
    expect(initialState.pool).toEqual({ brand: null, q: '', page: 0, grand: null, grandFor: null });
    expect(reducer(ready, { type: 'setPool', patch: { brand: 'hosttail', q: '081', page: 2 } }).pool)
      .toEqual({ brand: 'hosttail', q: '081', page: 2, grand: null, grandFor: null });
  });
  it('invalidatePool bumps poolVersion; live and focusSearch start false', () => {
    expect(initialState).toMatchObject({ live: false, poolVersion: 0, ui: { focusSearch: false } });
    expect(ready.live).toBe(true);
    expect(reducer(reducer(ready, { type: 'invalidatePool' }), { type: 'invalidatePool' }).poolVersion).toBe(2);
  });
});
