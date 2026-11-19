import { beforeEach, describe, expect, it, vi } from 'vitest';

const { rpc, from } = vi.hoisted(() => ({ rpc: vi.fn(), from: vi.fn() }));
vi.mock('@/lib/supabase/client', () => ({ db: () => ({ rpc, from }) }));

import { addMember, claimCustomer, getBaseCustomers, getMe, logContact, setCampaignClaimMode } from './rpc';

beforeEach(() => {
  rpc.mockReset();
  from.mockReset();
});

/** from('dsales_campaigns').update(..).eq(..).select('id') → result */
function updateChain(result: unknown) {
  const select = vi.fn().mockResolvedValue(result);
  const eq = vi.fn(() => ({ select }));
  const update = vi.fn(() => ({ eq }));
  from.mockReturnValue({ update });
  return { update, eq, select };
}

describe('setCampaignClaimMode', () => {
  it('updates the claim mode of the campaign', async () => {
    const c = updateChain({ data: [{ id: 'C1' }], error: null });
    await setCampaignClaimMode('C1', 'assign');
    expect(from).toHaveBeenCalledWith('dsales_campaigns');
    expect(c.update).toHaveBeenCalledWith({ claim_mode: 'assign' });
    expect(c.eq).toHaveBeenCalledWith('id', 'C1');
  });
  it('throws when RLS filters the update to no rows (no longer an admin)', async () => {
    updateChain({ data: [], error: null });
    await expect(setCampaignClaimMode('C1', 'assign')).rejects.toThrow('ไม่มีสิทธิ์ทำรายการนี้');
  });
});

describe('rpc wrappers', () => {
  it('getMe returns the first row, or null', async () => {
    rpc.mockResolvedValueOnce({ data: [{ user_id: 'u1' }], error: null });
    await expect(getMe()).resolves.toEqual({ user_id: 'u1' });
    rpc.mockResolvedValueOnce({ data: [], error: null });
    await expect(getMe()).resolves.toBeNull();
    expect(rpc).toHaveBeenCalledWith('dsales_me', undefined);
  });
  it('passes RPC argument names exactly', async () => {
    rpc.mockResolvedValue({ data: { id: 'L1' }, error: null });
    await claimCustomer('0812345678', 'hosttail');
    expect(rpc).toHaveBeenCalledWith('dsales_claim_customer', { p_phone: '0812345678', p_brand: 'hosttail' });
    await addMember('  sale@example.com ', 'sales');
    expect(rpc).toHaveBeenLastCalledWith('dsales_add_member', { p_email: 'sale@example.com', p_role: 'sales' });
  });
  it('normalizes phone searches for mine/pool', async () => {
    rpc.mockResolvedValue({ data: [], error: null });
    await getBaseCustomers('pool', { search: '+66 81-234-5678', brand: 'bebeplay' });
    expect(rpc).toHaveBeenCalledWith('dsales_base_customers', { p_scope: 'pool', p_search: '0812345678', p_limit: 50, p_offset: 0, p_brand: 'bebeplay' });
    await getBaseCustomers('mine', { search: '  ' });
    expect(rpc).toHaveBeenLastCalledWith('dsales_base_customers', { p_scope: 'mine', p_search: null, p_limit: 50, p_offset: 0, p_brand: null });
  });
  it('throws the Thai message of the RPC error', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'customer_not_found' } });
    await expect(claimCustomer('0812345678', 'bebeplay')).rejects.toThrow('ไม่พบลูกค้ารายนี้');
  });
  it('carries the PostgREST status and code into RpcError (401 → auth)', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'permission denied for function dsales_me', code: '42501' }, status: 401 });
    await expect(getMe()).rejects.toMatchObject({ kind: 'auth' });
    rpc.mockResolvedValue({ data: null, error: { message: 'permission denied for function dsales_me', code: '42501' }, status: 403 });
    await expect(getMe()).rejects.toMatchObject({ kind: 'other' });
    rpc.mockResolvedValue({ data: null, error: { message: 'not_member', code: '42501' }, status: 403 });
    await expect(getMe()).rejects.toMatchObject({ kind: 'member' });
  });
  it('logContact passes the dsales_log arguments of the prototype (L572)', async () => {
    rpc.mockResolvedValue({ data: { id: 'L1' }, error: null });
    await logContact({ leadId: 'L1', type: 'chat', result: 'ตอบกลับแล้ว', note: 'n', status: 'won', callback: null, interest: 'i', bills: ['1'], amount: 990 });
    expect(rpc).toHaveBeenCalledWith('dsales_log', {
      p_lead: 'L1', p_type: 'chat', p_result: 'ตอบกลับแล้ว', p_note: 'n', p_status: 'won', p_callback: null, p_interest: 'i', p_bills: ['1'], p_amount: 990,
    });
  });
});
