import { beforeEach, describe, expect, it, vi } from 'vitest';

const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock('@/lib/supabase/client', () => ({ db: () => ({ rpc }) }));

import { addMember, claimCustomer, getBaseCustomers, getMe } from './rpc';

beforeEach(() => rpc.mockReset());

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
});
