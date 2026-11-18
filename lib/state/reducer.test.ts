import { describe, expect, it } from 'vitest';
import { leadJson } from '@/lib/api/test-helpers';
import type { Campaign } from '@/lib/api/types';
import { initialState, reducer, type AppState, type LoadedPayload } from './reducer';

const payload: LoadedPayload = {
  email: 'a@example.com', meId: 'u1', isAdmin: true, reps: [{ id: 'u1', name: 'Dev MPD', initials: 'DE', role: 'admin' }],
  campaigns: [], leads: [], today: '2026-11-04',
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
});
