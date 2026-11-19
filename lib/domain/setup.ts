import type { JstTagRow, Lead, MemberTagsRow, Rep } from '@/lib/api/types';

// หน้าตั้งค่า (prototype renderSetup L369-382) + การ์ดผูก tag JST (spec ข้อ 3) เป็นฟังก์ชันล้วน

export const roleLabel = (role: Rep['role']): string => (role === 'admin' ? 'หัวหน้า' : 'เซลล์');

/** จำนวนลีดที่เซลล์ดูแล (L372 นับจากลีดใน state) */
export const ownedCount = (leads: ReadonlyArray<Pick<Lead, 'owner'>>, repId: string): number => leads.filter((l) => l.owner === repId).length;

/** ปุ่มปิด/เปิดใช้งาน: เฉพาะสมาชิกจาก Supabase (มี active) และไม่ใช่ตัวเอง (DB ห้ามปิดตัวเอง: cannot_deactivate_self) */
export function activeToggle(r: Pick<Rep, 'id' | 'active'>, meId: string): { text: string; next: boolean } | null {
  if (r.active === undefined || r.id === meId) return null;
  return r.active ? { text: 'ปิดใช้งาน', next: false } : { text: 'เปิดใช้งาน', next: true };
}

/** แทน/เพิ่มสมาชิกในรายชื่อทีม (ผลของ dsales_add_member / ปิด-เปิดใช้งาน) คงชื่อของตัวเองจาก dsales_me */
export function upsertRep(reps: ReadonlyArray<Rep>, rep: Rep, meId: string): Rep[] {
  const i = reps.findIndex((r) => r.id === rep.id);
  if (i < 0) return [...reps, rep];
  const next = reps.slice();
  next[i] = rep.id === meId ? { ...reps[i], role: rep.role, active: rep.active } : { ...reps[i], ...rep };
  return next;
}

export interface TagChoice { tag: string; sessions: number; selected: boolean; owner: string | null }

/** tag Admin_* ทั้งหมดจาก JST พร้อมสถานะของเซลล์ที่เลือก: เลือกไว้ / เป็นของเซลล์คนอื่น (tag ละ 1 เจ้าของ เทียบแบบไม่สนตัวพิมพ์) */
export function tagChoices(
  tags: ReadonlyArray<JstTagRow>, memberTags: ReadonlyArray<MemberTagsRow>, userId: string, selected: ReadonlyArray<string>,
  reps: ReadonlyArray<Pick<Rep, 'id' | 'name'>>,
): TagChoice[] {
  const owner = new Map<string, string>();
  for (const m of memberTags) if (m.user_id !== userId) for (const t of m.jst_tags || []) owner.set(t.toLowerCase(), m.user_id);
  const sel = new Set(selected.map((t) => t.toLowerCase()));
  return tags.map((t) => {
    const o = owner.get(t.tag.toLowerCase()) ?? null;
    return { tag: t.tag, sessions: Number(t.sessions), selected: sel.has(t.tag.toLowerCase()), owner: o ? reps.find((r) => r.id === o)?.name || o : null };
  });
}

/** tag ที่บันทึกไว้ของเซลล์คนนั้น */
export const tagsOf = (memberTags: ReadonlyArray<MemberTagsRow>, userId: string): string[] => memberTags.find((m) => m.user_id === userId)?.jst_tags || [];

/** สลับ tag ในรายการที่เลือก */
export const toggleTag = (selected: ReadonlyArray<string>, tag: string): string[] =>
  selected.some((t) => t.toLowerCase() === tag.toLowerCase()) ? selected.filter((t) => t.toLowerCase() !== tag.toLowerCase()) : [...selected, tag];

/** มีการเปลี่ยนจากที่บันทึกไว้หรือไม่ (ไม่สนลำดับ/ตัวพิมพ์) */
export const tagsChanged = (a: ReadonlyArray<string>, b: ReadonlyArray<string>): boolean => {
  const k = (x: ReadonlyArray<string>) => [...x].map((t) => t.toLowerCase()).sort().join('\n');
  return k(a) !== k(b);
};

/** แทน tag ของเซลล์หนึ่งคนใน memberTags (ผลของ dsales_set_member_tags) */
export function withMemberTags(memberTags: ReadonlyArray<MemberTagsRow>, userId: string, tags: string[]): MemberTagsRow[] {
  return memberTags.some((m) => m.user_id === userId)
    ? memberTags.map((m) => (m.user_id === userId ? { ...m, jst_tags: tags } : m))
    : [...memberTags, { user_id: userId, jst_tags: tags }];
}
