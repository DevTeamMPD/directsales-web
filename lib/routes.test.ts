import { describe, expect, it } from 'vitest';
import { routeKey, routeMeta } from './routes';

const camps = [{ brand: 'bebeplay' }, { brand: 'bebeplay' }, { brand: 'hosttail' }] as const;

describe('routes', () => {
  it('maps paths to prototype route keys; unknown paths fall back to leads', () => {
    expect(routeKey('/leads')).toBe('leads');
    expect(routeKey('/mine/')).toBe('mine');
    expect(routeKey('/rfm')).toBe('rfm');
    expect(routeKey('/campaigns/hosttail')).toBe('campaign-hosttail');
    expect(routeKey('/nope')).toBe('leads');
    expect(routeKey(null)).toBe('leads');
  });
  it('gives the prototype titles and subs', () => {
    expect(routeMeta('/leads', [])).toEqual({ key: 'leads', title: 'Direct Sale', sub: 'ลูกค้าเก่า Direct Sale Lead' });
    expect(routeMeta('/dashboard', [])).toEqual({ key: 'dashboard', title: 'Dashboard', sub: 'ภาพรวมทีม Direct Sale' });
    expect(routeMeta('/setup', [])).toEqual({ key: 'setup', title: 'ตั้งค่า', sub: '' });
    expect(routeMeta('/mine', [])).toEqual({ key: 'mine', title: 'ลูกค้าของฉัน', sub: '' });
    expect(routeMeta('/pool', [])).toEqual({ key: 'pool', title: 'ถังกลาง', sub: '' });
    expect(routeMeta('/outreach', [])).toEqual({ key: 'outreach', title: 'ส่งข้อความ', sub: '' });
    expect(routeMeta('/rfm', [])).toEqual({ key: 'rfm', title: 'กลุ่มลูกค้า RFM', sub: 'แตะกลุ่มในแผนที่เพื่อดูแนวทางและกรองรายชื่อ' });
  });
  it('counts the brand campaigns in the campaign sub', () => {
    expect(routeMeta('/campaigns/bebeplay', camps)).toEqual({ key: 'campaign-bebeplay', title: 'แคมเปญ Bebeplay', sub: '2 แคมเปญ' });
    expect(routeMeta('/campaigns/hosttail', camps).sub).toBe('1 แคมเปญ');
  });
});
