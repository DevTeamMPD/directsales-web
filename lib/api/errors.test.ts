import { describe, expect, it } from 'vitest';
import { toThaiError } from './errors';

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
  it('falls back to the raw message, or a generic text', () => {
    expect(toThaiError('JWT expired')).toBe('JWT expired');
    expect(toThaiError('constructor')).toBe('constructor');
    expect(toThaiError('')).toBe('ทำรายการไม่สำเร็จ');
    expect(toThaiError(undefined)).toBe('ทำรายการไม่สำเร็จ');
  });
});
