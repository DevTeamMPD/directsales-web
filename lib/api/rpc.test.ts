import { beforeEach, describe, expect, it, vi } from 'vitest';

const { rpc, from } = vi.hoisted(() => ({ rpc: vi.fn(), from: vi.fn() }));
vi.mock('@/lib/supabase/client', () => ({ db: () => ({ rpc, from }) }));

import {
  addMember, cancelOutreach, claimCustomer, enqueueOutreach, findWorkerRooms, getBaseCustomers, getMe, getRoomsForPhones, getOutreachBatch, getOutreachBatches,
  getRfmConfig, getRfmMap, getTemplates, getWorkerStatus, logContact, previewOutreach, saveTemplate, setCampaignClaimMode, setWorkerSettings,
} from './rpc';

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
    expect(rpc).toHaveBeenCalledWith('dsales_base_customers', {
      p_scope: 'pool', p_search: '0812345678', p_limit: 50, p_offset: 0, p_brand: 'bebeplay', p_filters: {},
    });
    await getBaseCustomers('mine', { search: '  ' });
    expect(rpc).toHaveBeenLastCalledWith('dsales_base_customers', { p_scope: 'mine', p_search: null, p_limit: 50, p_offset: 0, p_brand: null, p_filters: {} });
  });
  it('sends the filters of mine/pool as p_filters', async () => {
    rpc.mockResolvedValue({ data: [], error: null });
    await getBaseCustomers('pool', { offset: 50, filters: { rfm: ['Loyal', ''], dormant_min: 91, dormant_max: 180, has_chat: true, sort: 'dormant_desc' } });
    expect(rpc).toHaveBeenCalledWith('dsales_base_customers', {
      p_scope: 'pool', p_search: null, p_limit: 50, p_offset: 50, p_brand: null,
      p_filters: { rfm: ['Loyal', ''], dormant_min: 91, dormant_max: 180, has_chat: true, sort: 'dormant_desc' },
    });
    await getBaseCustomers('pool', { filters: null });
    expect(rpc).toHaveBeenLastCalledWith('dsales_base_customers', expect.objectContaining({ p_filters: {} }));
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

describe('outreach rpc wrappers (outreach contract ข้อ 2)', () => {
  beforeEach(() => rpc.mockResolvedValue({ data: [], error: null }));
  it('templates: list per brand (null = every brand) and save', async () => {
    await getTemplates('bebeplay');
    expect(rpc).toHaveBeenLastCalledWith('dsales_templates_list', { p_brand: 'bebeplay' });
    await getTemplates(null);
    expect(rpc).toHaveBeenLastCalledWith('dsales_templates_list', { p_brand: null });
    await saveTemplate({ id: null, brand: 'hosttail', name: '  ทักลูกค้าเก่า ', body: 'สวัสดี {ชื่อ}', active: true });
    expect(rpc).toHaveBeenLastCalledWith('dsales_template_save', { p_id: null, p_brand: 'hosttail', p_name: 'ทักลูกค้าเก่า', p_body: 'สวัสดี {ชื่อ}', p_active: true });
  });
  it('preview / enqueue pass phones and the template id', async () => {
    await previewOutreach(['0811111111', '0822222222'], 'T1');
    expect(rpc).toHaveBeenLastCalledWith('dsales_outreach_preview', { p_phones: ['0811111111', '0822222222'], p_template: 'T1' });
    await enqueueOutreach(['0811111111'], 'T1');
    expect(rpc).toHaveBeenLastCalledWith('dsales_enqueue_outreach', { p_phones: ['0811111111'], p_template: 'T1' });
  });
  it('batches, batch detail and cancel', async () => {
    await getOutreachBatches();
    expect(rpc).toHaveBeenLastCalledWith('dsales_outreach_batches_mine', { p_limit: 50, p_offset: 0 });
    await getOutreachBatches(10, 20);
    expect(rpc).toHaveBeenLastCalledWith('dsales_outreach_batches_mine', { p_limit: 10, p_offset: 20 });
    await getOutreachBatch('B1');
    expect(rpc).toHaveBeenLastCalledWith('dsales_outreach_batch', { p_batch: 'B1' });
    rpc.mockResolvedValueOnce({ data: 2, error: null });
    await expect(cancelOutreach(['Q1', 'Q2'])).resolves.toBe(2);
    expect(rpc).toHaveBeenLastCalledWith('dsales_outreach_cancel', { p_ids: ['Q1', 'Q2'] });
  });
  it('worker status, settings and room search', async () => {
    await getWorkerStatus();
    expect(rpc).toHaveBeenLastCalledWith('dsales_worker_status_get', {});
    await setWorkerSettings({ interval: 60, lineCap: 0, testMode: true, testMsIds: [101, 202] });
    expect(rpc).toHaveBeenLastCalledWith('dsales_worker_settings_set', { p_interval: 60, p_line_cap: 0, p_test_mode: true, p_test_ms_ids: [101, 202] });
    await findWorkerRooms('  สมใจ ');
    expect(rpc).toHaveBeenLastCalledWith('dsales_worker_find_rooms', { p_query: 'สมใจ' });
  });
  it('maps the new error tokens to Thai', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { message: 'batch_too_large' } });
    await expect(enqueueOutreach(['0811111111'], 'T1')).rejects.toThrow('เลือกลูกค้าเกินจำนวนสูงสุดต่อชุด');
    rpc.mockResolvedValueOnce({ data: null, error: { message: 'template_not_found' } });
    await expect(previewOutreach(['0811111111'], 'T1')).rejects.toThrow('ไม่พบ template นี้ หรือถูกปิดใช้งานแล้ว');
  });
});

describe('getRoomsForPhones', () => {
  it('sends unique trimmed phones in chunks of 100 and joins the rows', async () => {
    rpc.mockImplementation(async (_fn: string, args: { p_phones: string[] }) => ({
      data: args.p_phones.map((p) => ({ phone: p, rooms: [] })), error: null,
    }));
    const phones = Array.from({ length: 250 }, (_, i) => `08${String(i).padStart(8, '0')}`);
    const rows = await getRoomsForPhones([...phones, ` ${phones[0]} `, '', '  ']);
    expect(rpc.mock.calls.map((c) => [c[0], (c[1] as { p_phones: string[] }).p_phones.length])).toEqual([
      ['dsales_rooms_for_phones', 100], ['dsales_rooms_for_phones', 100], ['dsales_rooms_for_phones', 50],
    ]);
    expect(rows).toHaveLength(250);
  });
  it('no phones = no call; null data = no rows', async () => {
    await expect(getRoomsForPhones([])).resolves.toEqual([]);
    expect(rpc).not.toHaveBeenCalled();
    rpc.mockResolvedValue({ data: null, error: null });
    await expect(getRoomsForPhones(['0812345678'])).resolves.toEqual([]);
  });
});

describe('RFM page RPCs', () => {
  it('reads the config and the map with scope, brand and view-as', async () => {
    rpc.mockResolvedValue({ data: [], error: null });
    await getRfmConfig();
    expect(rpc).toHaveBeenLastCalledWith('dsales_rfm_config_get', undefined);
    await getRfmMap('team', null);
    expect(rpc).toHaveBeenLastCalledWith('dsales_rfm_map', { p_scope: 'team', p_brand: null });
    await getRfmMap('mine', 'hosttail', 'u-9');
    expect(rpc).toHaveBeenLastCalledWith('dsales_rfm_map', { p_scope: 'mine', p_brand: 'hosttail', p_as: 'u-9' });
  });
});
