import { describe, expect, it } from 'vitest';
import type { Rep } from '@/lib/api/types';
import { fixturePayload } from '@/lib/fixtures/load';
import { activeToggle, ownedCount, roleLabel, tagChoices, tagsChanged, tagsOf, toggleTag, upsertRep, withMemberTags } from './setup';

const F = fixturePayload();
const reps: Rep[] = [
  { id: 'u1', name: 'หัวหน้า', initials: 'หั', role: 'admin', email: 'boss@example.com', active: true },
  { id: 'u2', name: 'พลอย', initials: 'พล', role: 'sales', email: 'ploy@example.com', active: true },
  { id: 'u3', name: 'มิ้นท์', initials: 'มิ', role: 'sales', email: 'mint@example.com', active: false },
];

describe('team panel (prototype renderSetup L372)', () => {
  it('role label and owned lead count', () => {
    expect([roleLabel('admin'), roleLabel('sales')]).toEqual(['หัวหน้า', 'เซลล์']);
    expect(F.reps.map((r) => ownedCount(F.leads, r.id))).toEqual([3, 9, 4, 7]);
  });
  it('activate/deactivate button: never for myself, never for fixture reps (no active flag)', () => {
    expect(activeToggle(reps[0], 'u1')).toBeNull();
    expect(activeToggle(reps[1], 'u1')).toEqual({ text: 'ปิดใช้งาน', next: false });
    expect(activeToggle(reps[2], 'u1')).toEqual({ text: 'เปิดใช้งาน', next: true });
    expect(activeToggle(F.reps[0], 'r4')).toBeNull();
  });
  it('upsertRep adds a new member, replaces an existing one, and keeps my own display name', () => {
    const added = upsertRep(reps, { id: 'u4', name: 'ใหม่', initials: 'ให', role: 'sales', active: true }, 'u1');
    expect(added.map((r) => r.id)).toEqual(['u1', 'u2', 'u3', 'u4']);
    expect(upsertRep(reps, { ...reps[2], active: true }, 'u1')[2].active).toBe(true);
    expect(upsertRep(reps, { id: 'u1', name: 'boss', initials: 'BO', role: 'admin', active: true }, 'u1')[0].name).toBe('หัวหน้า');
  });
});

describe('JST tag card (spec ข้อ 3)', () => {
  const tags = [{ tag: 'Admin_Ploy', sessions: 120 }, { tag: 'Admin_Mint', sessions: 80 }, { tag: 'Admin_New', sessions: 3 }];
  const memberTags = [{ user_id: 'u2', jst_tags: ['Admin_Ploy'] }, { user_id: 'u3', jst_tags: ['admin_mint'] }];
  it('marks the tags chosen for the rep and the ones owned by other reps (case-insensitive)', () => {
    expect(tagChoices(tags, memberTags, 'u2', tagsOf(memberTags, 'u2'), reps)).toEqual([
      { tag: 'Admin_Ploy', sessions: 120, selected: true, owner: null },
      { tag: 'Admin_Mint', sessions: 80, selected: false, owner: 'มิ้นท์' },
      { tag: 'Admin_New', sessions: 3, selected: false, owner: null },
    ]);
    expect(tagsOf(memberTags, 'u1')).toEqual([]);
  });
  it('toggle / changed / replace after save', () => {
    expect(toggleTag(['Admin_Ploy'], 'admin_ploy')).toEqual([]);
    expect(toggleTag(['Admin_Ploy'], 'Admin_New')).toEqual(['Admin_Ploy', 'Admin_New']);
    expect(tagsChanged(['Admin_New', 'Admin_Ploy'], ['admin_ploy', 'Admin_New'])).toBe(false);
    expect(tagsChanged(['Admin_New'], [])).toBe(true);
    expect(withMemberTags(memberTags, 'u2', ['Admin_New'])).toEqual([{ user_id: 'u2', jst_tags: ['Admin_New'] }, memberTags[1]]);
    expect(withMemberTags(memberTags, 'u1', ['Admin_X'])).toHaveLength(3);
  });
});
