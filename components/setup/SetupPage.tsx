'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { errorMessage } from '@/lib/api/errors';
import { mapTeamRow } from '@/lib/api/map';
import { addMember, getJstAdminTags, getMemberTags, setCampaignClaimMode, setMemberActive, setMemberTags } from '@/lib/api/rpc';
import type { Campaign, ClaimMode, JstTagRow, MemberTagsRow, Role } from '@/lib/api/types';
import { BRAND, FIXTURE_NO_WRITE, MODES } from '@/lib/constants';
import { activeToggle, ownedCount, roleLabel, tagChoices, tagsChanged, tagsOf, toggleTag, withMemberTags } from '@/lib/domain/setup';
import { fmtDate } from '@/lib/format';
import { useActions, useAppState } from '@/lib/state/AppProvider';

/**
 * ตั้งค่า (renderSetup L369-382) หัวหน้าเท่านั้น — ต่างจาก prototype โดยตั้งใจ:
 * - ทีมเซลล์มาจาก dsales_team: เพิ่มด้วยอีเมล + บทบาท (dsales_add_member) และปิด/เปิดใช้งาน (dsales_set_member_active)
 * - การ์ดใหม่ "ผูก tag JST กับเซลล์" (dsales_jst_admin_tags / dsales_member_tags / dsales_set_member_tags)
 * - ไม่มีการ์ด "ข้อมูลตัวอย่าง" (รีเซ็ต localStorage ของโหมดตัวอย่าง)
 */
export function SetupPage() {
  return (
    <div className="settings">
      <TeamPanel />
      <CampaignPanel />
      <TagPanel />
    </div>
  );
}

function TeamPanel() {
  const { reps, leads, meId, live } = useAppState();
  const { dispatch, toast, toastError, once } = useActions();
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Role>('sales');

  async function onAdd(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!email.trim()) return;
    if (!live) {
      toast(FIXTURE_NO_WRITE);
      return;
    }
    await once('add-member', async () => {
      try {
        const m = await addMember(email, role);
        dispatch({ type: 'upsertRep', rep: mapTeamRow(m) });
        setEmail('');
        toast('เพิ่มเซลล์แล้ว');
      } catch (err) {
        toastError(err);
      }
    });
  }

  async function onToggle(id: string, next: boolean) {
    if (!live) {
      toast(FIXTURE_NO_WRITE);
      return;
    }
    await once(`member-active:${id}`, async () => {
      try {
        await setMemberActive(id, next);
        const r = reps.find((x) => x.id === id);
        if (r) dispatch({ type: 'upsertRep', rep: { ...r, active: next } });
        toast(next ? 'เปิดใช้งานแล้ว' : 'ปิดใช้งานแล้ว');
      } catch (err) {
        toastError(err);
      }
    });
  }

  return (
    <div className="panel">
      <div className="panel-h"><h2>ทีมเซลล์</h2></div>
      <div className="panel-b">
        {reps.map((r) => {
          const t = activeToggle(r, meId);
          return (
            <div key={r.id} className="list-row">
              <div>
                <b>{r.name}</b>
                {r.email ? <div className="sub">{r.email}</div> : null}
              </div>
              <span className="tag">{roleLabel(r.role)}</span>
              {r.active === false ? <span className="badge s-lost plain">ปิดใช้งาน</span> : null}
              <span className="sub">{ownedCount(leads, r.id)} ลีด</span>
              {t ? <button className="btn sm" data-member={r.id} onClick={() => void onToggle(r.id, t.next)}>{t.text}</button> : null}
            </div>
          );
        })}
        <form className="inline-form" id="rep-form" onSubmit={(e) => void onAdd(e)}>
          <input className="input" id="rep-email" type="email" placeholder="อีเมลเซลล์ (บัญชีที่ใช้ล็อกอิน)" required value={email} onChange={(e) => setEmail(e.target.value)} />
          <select className="select" id="rep-role" value={role} onChange={(e) => setRole(e.target.value as Role)}>
            <option value="sales">เซลล์</option>
            <option value="admin">หัวหน้า</option>
          </select>
          <button className="btn primary">เพิ่ม</button>
        </form>
        <p className="help" style={{ marginTop: 10 }}>เพิ่มได้เฉพาะอีเมลที่มีบัญชีพนักงานในระบบแล้ว บัญชีที่ไม่อยู่ในรายชื่อนี้หรือถูกปิดใช้งานจะเข้าใช้งานไม่ได้</p>
      </div>
    </div>
  );
}

function CampaignPanel() {
  const { campaigns, live } = useAppState();
  const { dispatch, toast, handleAuthError } = useActions();
  // แคมเปญที่กำลังบันทึก: ล็อกช่องเลือกไว้จนเสร็จ กันเปลี่ยนซ้อนแล้วคืนค่าผิดเมื่อครั้งแรกล้ม
  const [saving, setSaving] = useState<string | null>(null);

  async function onMode(c: Campaign, mode: ClaimMode) {
    if (!live) {
      toast(FIXTURE_NO_WRITE);
      return;
    }
    if (saving) return;
    setSaving(c.id);
    dispatch({ type: 'upsertCampaign', campaign: { ...c, claimMode: mode } }); // L898: เปลี่ยนใน state ก่อน แล้วค่อยบันทึก
    try {
      await setCampaignClaimMode(c.id, mode);
      toast('บันทึกวิธีจองลีดแล้ว');
    } catch (e) {
      dispatch({ type: 'upsertCampaign', campaign: c });
      if (!handleAuthError(e)) toast('บันทึกไม่สำเร็จ');
    } finally {
      setSaving(null);
    }
  }

  return (
    <div className="panel">
      <div className="panel-h"><h2>แคมเปญ</h2></div>
      <div className="panel-b">
        {campaigns.map((c) => (
          <div key={c.id} className="list-row">
            <div><b>{c.name}</b><div className="sub">{fmtDate(c.start)} – {fmtDate(c.end)}</div></div>
            <span className={`tag ${c.brand === 'bebeplay' ? 'bebe' : 'host'}`}>{BRAND[c.brand]}</span>
            <select className="select" data-claimmode={c.id} aria-label="วิธีจองลีด" value={c.claimMode || 'self'} disabled={saving === c.id} onChange={(e) => void onMode(c, e.target.value as ClaimMode)}>
              {(Object.keys(MODES) as ClaimMode[]).map((k) => <option key={k} value={k}>{MODES[k]}</option>)}
            </select>
          </div>
        ))}
        <p className="help" style={{ marginTop: 10 }}>สร้างแคมเปญใหม่ได้ที่เมนู แคมเปญ → Bebeplay / Hosttail (เฉพาะหัวหน้า)</p>
      </div>
    </div>
  );
}

/**
 * ผูก tag Admin_* ของ JST กับเซลล์ (spec ข้อ 3): เลือกเซลล์ → กดชิป tag (เลือกได้หลายอัน) → บันทึก
 * บันทึกแล้ว DB คำนวณฐานลูกค้าใหม่ทั้งหมด (dsales_refresh_customer_base) ใช้เวลาหลายวินาที → ปุ่ม/ชิป disabled + "กำลังบันทึก…"
 */
function TagPanel() {
  const { reps, live } = useAppState();
  const { dispatch, toast, toastError, once, handleAuthError } = useActions();
  const [tags, setTags] = useState<JstTagRow[] | null>(live ? null : []);
  const [memberTags, setMemberTagsState] = useState<MemberTagsRow[]>([]);
  const [err, setErr] = useState('');
  const [userId, setUserId] = useState(reps[0]?.id ?? '');
  const [selected, setSelected] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!live) return;
    let alive = true;
    Promise.all([getJstAdminTags(), getMemberTags()]).then(
      ([t, m]) => {
        if (!alive) return;
        setTags(t || []);
        setMemberTagsState(m || []);
      },
      (e: unknown) => {
        if (!alive || handleAuthError(e)) return;
        setErr('โหลด tag ไม่สำเร็จ: ' + errorMessage(e));
        setTags([]);
      },
    );
    return () => {
      alive = false;
    };
  }, [live, handleAuthError]);

  // เปลี่ยนเซลล์ / โหลดเสร็จ → เริ่มจาก tag ที่บันทึกไว้ของคนนั้น
  useEffect(() => {
    setSelected(tagsOf(memberTags, userId));
  }, [memberTags, userId]);

  const saved = tagsOf(memberTags, userId);
  const choices = tagChoices(tags || [], memberTags, userId, selected, reps);

  async function onSave() {
    if (!live) {
      toast(FIXTURE_NO_WRITE);
      return;
    }
    await once('member-tags', async () => {
      setSaving(true);
      try {
        const next = await setMemberTags(userId, selected);
        setMemberTagsState((m) => withMemberTags(m, userId, next || []));
        dispatch({ type: 'invalidatePool' });
        toast('บันทึก tag แล้ว · คำนวณลูกค้าของเซลล์ใหม่แล้ว');
      } catch (e) {
        toastError(e);
      } finally {
        setSaving(false);
      }
    });
  }

  return (
    <div className="panel">
      <div className="panel-h"><h2>ผูก tag JST กับเซลล์</h2></div>
      <div className="panel-b">
        <p className="help">เลือก tag Admin_* ของห้องแชตใน JST ให้เซลล์แต่ละคน ลูกค้าในห้องแชตที่ติด tag นั้นจะเป็น &quot;ลูกค้าของฉัน&quot; ของเซลล์คนนั้น (1 tag มีเจ้าของได้คนเดียว)</p>
        <div className="inline-form">
          <select className="select" id="tag-rep" aria-label="เซลล์" value={userId} disabled={saving} onChange={(e) => setUserId(e.target.value)}>
            {reps.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
        </div>
        {err ? <div className="login-err">{err}</div> : null}
        {tags === null ? (
          <p className="help" style={{ marginTop: 10 }}>กำลังโหลด tag จาก JST…</p>
        ) : choices.length ? (
          <div className="toolbar" style={{ marginTop: 10 }}>
            {choices.map((c) => (
              <button
                key={c.tag} type="button" className={`chip ${c.selected ? 'active' : ''}`} data-tag={c.tag}
                disabled={saving || !!c.owner} title={c.owner ? `เป็นของ ${c.owner}` : undefined}
                onClick={() => setSelected((s) => toggleTag(s, c.tag))}
              >
                {c.tag} ({c.sessions.toLocaleString('th-TH')})
              </button>
            ))}
          </div>
        ) : (
          <div className="empty">ไม่พบ tag Admin_* ใน JST</div>
        )}
        <div className="inline-form">
          <button className="btn primary" id="tag-save" disabled={saving || !userId || !tagsChanged(selected, saved)} onClick={() => void onSave()}>
            {saving ? 'กำลังบันทึก…' : 'บันทึก tag'}
          </button>
        </div>
        <p className="help" style={{ marginTop: 10 }}>บันทึกแล้วลูกค้าที่มี tag นี้จะย้ายไปอยู่ใน &ldquo;ลูกค้าของฉัน&rdquo; ของเซลล์คนนั้นทันที (tag ที่เพิ่งติดใหม่ใน JST จะเข้ามาในรอบอัปเดตรายชั่วโมง)</p>
      </div>
    </div>
  );
}
