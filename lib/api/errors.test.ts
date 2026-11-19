import { describe, expect, it } from 'vitest';
import { ERROR_TEXT, errorKind, errorMessage, kindOf, NETWORK_TEXT, RpcError, toThaiError } from './errors';

describe('toThaiError', () => {
  it('maps every prototype LIVE_ERR key', () => {
    expect(toThaiError('taken')).toBe('ลูกค้ารายนี้มีคนจองไปแล้ว');
    expect(toThaiError('no_call')).toBe('ลูกค้ารายนี้ไม่สะดวกให้โทร');
    expect(toThaiError('forbidden')).toBe('ไม่มีสิทธิ์ทำรายการนี้');
    expect(toThaiError('bill_required')).toBe('ใส่เลขบิลก่อนปิดการขาย');
    expect(toThaiError('not_found')).toBe('ไม่พบข้อมูลรายการนี้');
    expect(toThaiError('invalid_phone')).toBe('เบอร์โทรของลูกค้าไม่ถูกต้อง');
    expect(toThaiError('invalid_user')).toBe('ผู้ใช้ไม่ถูกต้อง');
    expect(toThaiError('invalid_brand')).toBe('ไม่ทราบแบรนด์ของการจอง');
  });
  it('does not let not_found shadow the longer *_not_found keys', () => {
    expect(toThaiError('customer_not_found')).toBe('ไม่พบลูกค้ารายนี้');
    expect(toThaiError('member_not_found')).toBe('ไม่พบเซลล์รายนี้ในทีม');
    expect(toThaiError('user_not_found')).toBe('ไม่พบบัญชีผู้ใช้อีเมลนี้ในระบบ');
  });
  it('maps membership errors', () => {
    expect(toThaiError('not_member')).toBe('บัญชีนี้ยังไม่มีสิทธิ์ใช้งาน ติดต่อหัวหน้า');
    expect(toThaiError('not_authenticated')).toBe('หมดเวลาการเข้าสู่ระบบ กรุณาเข้าสู่ระบบใหม่');
    expect(toThaiError('invalid_role')).toBe('บทบาทไม่ถูกต้อง');
    expect(toThaiError('cannot_deactivate_self')).toBe('ปิดใช้งานบัญชีของตัวเองไม่ได้');
    expect(toThaiError('last_admin')).toBe('ต้องมีหัวหน้าอย่างน้อย 1 คน');
  });
  it('names the tag in tag_taken', () => {
    expect(toThaiError('tag_taken: Admin_Ploy')).toBe('tag Admin_Ploy เป็นของเซลล์คนอื่นแล้ว');
  });
  it('names the tag even when the message is prefixed', () => {
    expect(toThaiError('ERROR: tag_taken: Admin_X')).toBe('tag Admin_X เป็นของเซลล์คนอื่นแล้ว');
  });
  it('finds the key inside a longer message', () => {
    expect(toThaiError('ERROR: not_member (SQLSTATE 42501)')).toBe('บัญชีนี้ยังไม่มีสิทธิ์ใช้งาน ติดต่อหัวหน้า');
  });
  it('maps an expired or invalid JWT to the re-login text', () => {
    expect(toThaiError('JWT expired')).toBe('หมดเวลาการเข้าสู่ระบบ กรุณาเข้าสู่ระบบใหม่');
    expect(toThaiError('invalid JWT: unable to parse or verify signature')).toBe('หมดเวลาการเข้าสู่ระบบ กรุณาเข้าสู่ระบบใหม่');
  });
  it('maps network failures of every browser to Thai', () => {
    for (const m of ['TypeError: Failed to fetch', 'NetworkError when attempting to fetch resource.', 'Load failed', 'fetch failed']) {
      expect(toThaiError(m), m).toBe(NETWORK_TEXT);
    }
  });
  it('maps a Postgres statement timeout to Thai', () => {
    expect(toThaiError('canceling statement due to statement timeout')).toBe(ERROR_TEXT.statement_timeout);
  });
  it('falls back to the raw message, or a generic text', () => {
    expect(toThaiError('duplicate key value')).toBe('duplicate key value');
    expect(toThaiError('constructor')).toBe('constructor');
    expect(toThaiError('')).toBe('ทำรายการไม่สำเร็จ');
    expect(toThaiError(undefined)).toBe('ทำรายการไม่สำเร็จ');
  });
});

describe('errorKind / RpcError / kindOf', () => {
  it('classifies raw server messages', () => {
    expect(errorKind('JWT expired')).toBe('auth');
    expect(errorKind('ERROR: not_authenticated')).toBe('auth');
    expect(errorKind('ERROR: not_member (SQLSTATE 42501)')).toBe('member');
    expect(errorKind('TypeError: Failed to fetch')).toBe('network');
    expect(errorKind('taken')).toBe('other');
    expect(errorKind(undefined)).toBe('other');
  });
  it('classifies by PostgREST status/code, not only message', () => {
    // refresh token ตาย → supabase-js ส่ง anon key → 401 permission denied (42501)
    expect(errorKind('permission denied for function dsales_me', { status: 401, code: '42501' })).toBe('auth');
    expect(errorKind('ERROR: not_member', { status: 403, code: '42501' })).toBe('member');
    expect(errorKind('ERROR: not_member', { status: 401 })).toBe('member');
    // authenticated แต่ขาด grant → 403 = ไม่ใช่ session หมดอายุ
    expect(errorKind('permission denied for function dsales_me', { status: 403, code: '42501' })).toBe('other');
    expect(errorKind('whatever', { code: 'PGRST301' })).toBe('auth');
    expect(errorKind('permission denied for function dsales_me')).toBe('other');
    expect(new RpcError('permission denied for function dsales_me', { status: 401, code: '42501' }).kind).toBe('auth');
  });
  it('RpcError keeps the Thai text and the kind of the raw message', () => {
    const e = new RpcError('JWT expired');
    expect([e.message, e.kind, e instanceof Error]).toEqual(['หมดเวลาการเข้าสู่ระบบ กรุณาเข้าสู่ระบบใหม่', 'auth', true]);
    expect(kindOf(e)).toBe('auth');
    expect(kindOf(new RpcError('not_member'))).toBe('member');
    expect(kindOf(new TypeError('Failed to fetch'))).toBe('network');
    expect(kindOf('boom')).toBe('other');
  });
});

describe('errorMessage', () => {
  it('reads Error.message or a string, and falls back to the generic text', () => {
    expect(errorMessage(new Error('ลูกค้ารายนี้มีคนจองไปแล้ว'))).toBe('ลูกค้ารายนี้มีคนจองไปแล้ว');
    expect(errorMessage('boom')).toBe('boom');
    expect(errorMessage(new Error(''))).toBe('ทำรายการไม่สำเร็จ');
    expect(errorMessage(undefined)).toBe('ทำรายการไม่สำเร็จ');
  });
  it('translates a raw network TypeError (fetch outside rpc.ts)', () => {
    expect(errorMessage(new TypeError('Failed to fetch'))).toBe(NETWORK_TEXT);
  });
});
