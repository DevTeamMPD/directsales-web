'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { errorMessage } from '@/lib/api/errors';
import { findWorkerRooms, getTemplates, getWorkerStatus, resetWorkerState, saveTemplate, setWorkerPrimary, setWorkerSettings } from '@/lib/api/rpc';
import type { Template, WorkerRoom, WorkerStatus } from '@/lib/api/types';
import { BRAND, FIXTURE_NO_WRITE, type Brand } from '@/lib/constants';
import { pageBrand } from '@/lib/domain/brand';
import {
  CLOUD_WORKER_ID, isWorkerOnline, renderTemplate, roomLabel, SAMPLE_VALUES, stamp, TEMPLATE_VARS, toggleRoom, upsertTemplate, validateSettings, validateTemplate,
  standbyActive, workerBadge, workerRole,
} from '@/lib/domain/outreach';
import { useActions, useAppState } from '@/lib/state/AppProvider';

interface TplForm { id: string | null; name: string; body: string; active: boolean }
const EMPTY_TPL: TplForm = { id: null, name: '', body: '', active: true };

/**
 * การ์ด Template ข้อความ (spec ข้อ 6.4): รายการต่อแบรนด์ (หัวหน้าเห็นที่ปิดใช้ด้วย), สร้าง/แก้/ปิด-เปิดใช้งาน (dsales_template_save)
 * พร้อมตัวอย่างการแทนตัวแปรด้วยค่าตัวอย่างระหว่างพิมพ์
 * แบรนด์เริ่มต้น = แบรนด์ใหญ่ใน topbar (ทั้งหมด = Bebeplay) และตามเมื่อแบรนด์ใหญ่เปลี่ยน · ยังเปลี่ยนใน #tpl-brand ได้
 */
export function TemplatePanel() {
  const { live, outreachDemo, brand: scope } = useAppState();
  const { toast, toastError, once, handleAuthError } = useActions();
  const [liveList, setLiveList] = useState<Template[] | null>(null);
  const [err, setErr] = useState('');
  const [brand, setBrand] = useState<Brand>(() => pageBrand(scope) || 'bebeplay');
  const [form, setForm] = useState<TplForm>(EMPTY_TPL);
  const [formErr, setFormErr] = useState('');
  const [saving, setSaving] = useState(false);
  // แบรนด์ใหญ่เปลี่ยนเป็น Bebeplay/Hosttail = รายการ template ตามไปด้วย (ปรับระหว่าง render; "ทั้งหมด" คงแบรนด์เดิม)
  const [followed, setFollowed] = useState(scope);
  if (followed !== scope) {
    setFollowed(scope);
    const b = pageBrand(scope);
    if (b && b !== brand) {
      setBrand(b);
      setForm(EMPTY_TPL);
    }
  }

  useEffect(() => {
    if (!live) return;
    let alive = true;
    getTemplates(null).then(
      (l) => {
        if (alive) setLiveList(l || []);
      },
      (e: unknown) => {
        if (!alive || handleAuthError(e)) return;
        setErr('โหลด template ไม่สำเร็จ: ' + errorMessage(e));
        setLiveList([]);
      },
    );
    return () => {
      alive = false;
    };
  }, [live, handleAuthError]);

  const all = live ? liveList : outreachDemo?.templates ?? [];
  const list = (all ?? []).filter((t) => t.brand === brand);
  const preview = renderTemplate(form.body, SAMPLE_VALUES);

  async function save(input: TplForm, done: string) {
    if (!live) {
      toast(FIXTURE_NO_WRITE);
      return;
    }
    await once('template-save', async () => {
      setSaving(true);
      try {
        const t = await saveTemplate({ ...input, brand });
        setLiveList((l) => upsertTemplate(l ?? [], t));
        setForm(EMPTY_TPL);
        toast(done);
      } catch (e) {
        toastError(e);
      } finally {
        setSaving(false);
      }
    });
  }

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const v = validateTemplate(form.name, form.body);
    setFormErr(v ?? '');
    if (v) return;
    void save(form, form.id ? 'บันทึก template แล้ว' : 'สร้าง template แล้ว');
  }

  return (
    <div className="panel" id="tpl-panel">
      <div className="panel-h">
        <h2>Template ข้อความ</h2>
        <select className="select" id="tpl-brand" aria-label="แบรนด์ของ template" value={brand} onChange={(e) => { setBrand(e.target.value as Brand); setForm(EMPTY_TPL); }}>
          {(Object.keys(BRAND) as Brand[]).map((b) => <option key={b} value={b}>{BRAND[b]}</option>)}
        </select>
      </div>
      <div className="panel-b">
        {err ? <div className="login-err">{err}</div> : null}
        {all === null ? (
          <p className="help">กำลังโหลด template…</p>
        ) : list.length ? (
          list.map((t) => (
            <div key={t.id} className="list-row" data-tpl={t.id}>
              <div>
                <b>{t.name}</b>
                <div className="sub" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.body}</div>
              </div>
              {t.active ? <span className="badge s-won plain">เปิดใช้</span> : <span className="badge s-new plain">ปิดใช้</span>}
              <button className="btn sm" data-tpl-edit={t.id} disabled={saving} onClick={() => { setForm({ id: t.id, name: t.name, body: t.body, active: t.active }); setFormErr(''); }}>แก้ไข</button>
              <button
                className="btn sm" data-tpl-toggle={t.id} disabled={saving}
                onClick={() => void save({ id: t.id, name: t.name, body: t.body, active: !t.active }, t.active ? 'ปิดใช้ template แล้ว' : 'เปิดใช้ template แล้ว')}
              >
                {t.active ? 'ปิดใช้' : 'เปิดใช้'}
              </button>
            </div>
          ))
        ) : (
          <div className="empty" style={{ padding: 24 }}>ยังไม่มี template ของ {BRAND[brand]}</div>
        )}
        <form id="tpl-form" onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 12 }}>
          <div className="sub"><b>{form.id ? 'แก้ไข template' : `สร้าง template ใหม่ (${BRAND[brand]})`}</b></div>
          <input className="input" id="tpl-name" placeholder="ชื่อ template เช่น ทักลูกค้าเก่า 6 เดือน" value={form.name} disabled={saving} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
          <textarea className="textarea" id="tpl-body" placeholder="ข้อความ ใช้ตัวแปร {ชื่อ} {สินค้าล่าสุด} {ร้าน} ได้" value={form.body} disabled={saving} onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))} />
          <label className="switch">
            <input type="checkbox" id="tpl-active" checked={form.active} disabled={saving} onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))} />
            <span />
            เปิดใช้งาน
          </label>
          {form.body.trim() ? (
            <div className="chk" id="tpl-preview">
              <div className="sub"><b>ตัวอย่าง</b> (ค่าตัวอย่าง)</div>
              <div style={{ whiteSpace: 'pre-wrap' }}>{preview.text}</div>
              {preview.unknown.length ? <div className="sub" style={{ color: 'var(--bad)' }}>ไม่รู้จักตัวแปร {preview.unknown.join(' ')} — จะส่งตามที่พิมพ์</div> : null}
            </div>
          ) : null}
          {formErr ? <div className="login-err">{formErr}</div> : null}
          <div className="toolbar">
            <button className="btn primary" id="tpl-save" disabled={saving}>{saving ? 'กำลังบันทึก…' : form.id ? 'บันทึก template' : 'สร้าง template'}</button>
            {form.id ? <button type="button" className="btn" id="tpl-cancel" disabled={saving} onClick={() => setForm(EMPTY_TPL)}>ยกเลิกแก้ไข</button> : null}
          </div>
        </form>
        <p className="help" style={{ marginTop: 10 }}>
          ตัวแปร: {TEMPLATE_VARS.map((v) => `${v.key} = ${v.label}`).join(' · ')} — ลูกค้าที่ไม่มีค่านั้นจะแทนด้วยข้อความว่าง เซลล์เห็นเฉพาะ template ที่เปิดใช้
        </p>
      </div>
    </div>
  );
}

interface SetForm { interval: string; lineCap: string; testMode: boolean; testMsIds: number[] }
const toForm = (s: WorkerStatus): SetForm => ({
  interval: String(s.settings.interval_seconds), lineCap: String(s.settings.line_monthly_cap), testMode: !!s.settings.test_mode, testMsIds: [...(s.settings.test_ms_ids ?? [])],
});

/**
 * การ์ด Worker (spec ข้อ 6.4): สถานะ worker (ออนไลน์ = heartbeat < 3 นาที, state, session JST, ส่งชั่วโมงนี้, คิวรอ, error ล่าสุด)
 * และตั้งค่า (dsales_worker_settings_set): ระยะห่าง, เพดาน LINE ต่อเดือน, โหมดทดสอบ + ห้องทดสอบ (ค้นด้วย dsales_worker_find_rooms)
 */
export function WorkerPanel() {
  const { live, outreachDemo } = useAppState();
  const { toast, toastError, once, handleAuthError } = useActions();
  const [liveStatus, setLiveStatus] = useState<WorkerStatus | null>(null);
  const [err, setErr] = useState('');
  const [form, setForm] = useState<SetForm | null>(() => (!live && outreachDemo ? toForm(outreachDemo.worker) : null));
  const [formErr, setFormErr] = useState('');
  const [saving, setSaving] = useState(false);
  const [q, setQ] = useState('');
  const [rooms, setRooms] = useState<WorkerRoom[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [busyWorker, setBusyWorker] = useState('');
  const [busyKind, setBusyKind] = useState<'primary' | 'reset' | ''>('');
  /** worker ที่กดตั้งตัวหลักครั้งแรกแล้ว (รอกดยืนยัน) */
  const [armed, setArmed] = useState('');
  const armTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** worker_id → heartbeat_at ตอนกดเริ่มใหม่ · ล้างเมื่อ heartbeat เปลี่ยน */
  const [resetAt, setResetAt] = useState<ReadonlyMap<string, string | null>>(new Map());
  useEffect(() => () => {
    if (armTimer.current) clearTimeout(armTimer.current);
  }, []);
  // ป้ายของห้องที่เคยเห็นจากผลค้นหา (dsales_worker_status_get คืนแค่ ms_id ของห้องทดสอบ)
  const [known, setKnown] = useState<ReadonlyMap<number, WorkerRoom>>(() => new Map((outreachDemo?.rooms ?? []).map((r) => [r.ms_id, r])));

  useEffect(() => {
    if (!live) return;
    let alive = true;
    getWorkerStatus().then(
      (s) => {
        if (!alive) return;
        setLiveStatus(s);
        setForm(toForm(s));
      },
      (e: unknown) => {
        if (!alive || handleAuthError(e)) return;
        setErr('โหลดสถานะ worker ไม่สำเร็จ: ' + errorMessage(e));
      },
    );
    return () => {
      alive = false;
    };
  }, [live, handleAuthError]);

  const status = live ? liveStatus : outreachDemo?.worker ?? null;
  const covering = status ? standbyActive(status) : false;

  async function onSearch(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const text = q.trim();
    if (text.length < 2) {
      setRooms([]);
      return;
    }
    if (!live) {
      setRooms((outreachDemo?.rooms ?? []).filter((r) => (r.customer || '').toLowerCase().includes(text.toLowerCase())));
      return;
    }
    setSearching(true);
    try {
      const r = (await findWorkerRooms(text)) || [];
      setRooms(r);
      setKnown((m) => new Map([...m, ...r.map((x) => [x.ms_id, x] as const)]));
    } catch (e2) {
      toastError(e2);
    } finally {
      setSearching(false);
    }
  }

  async function onSave(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!form) return;
    const v = validateSettings(form);
    setFormErr(v ?? '');
    if (v) return;
    if (!live) {
      toast(FIXTURE_NO_WRITE);
      return;
    }
    await once('worker-settings', async () => {
      setSaving(true);
      try {
        const s = await setWorkerSettings({ interval: Number(form.interval), lineCap: Number(form.lineCap), testMode: form.testMode, testMsIds: form.testMsIds });
        setLiveStatus(s);
        setForm(toForm(s));
        toast('บันทึกการตั้งค่า worker แล้ว');
      } catch (e2) {
        toastError(e2);
      } finally {
        setSaving(false);
      }
    });
  }

  function disarm() {
    if (armTimer.current) clearTimeout(armTimer.current);
    armTimer.current = null;
    setArmed('');
  }

  /** ปุ่มของ worker แต่ละตัว: ตั้งตัวหลัก (กด 2 ครั้ง) / เริ่มใหม่ — ทั้งคู่คืนสถานะล่าสุด */
  async function workerAction(w: WorkerStatus['workers'][number], kind: 'primary' | 'reset') {
    const id = w.worker_id;
    if (kind === 'primary' && armed !== id) {
      disarm();
      setArmed(id);
      armTimer.current = setTimeout(() => setArmed(''), 5000);
      return;
    }
    disarm();
    if (!live) {
      toast(FIXTURE_NO_WRITE);
      return;
    }
    await once(`worker-act-${id}`, async () => {
      setBusyWorker(id);
      setBusyKind(kind);
      try {
        setLiveStatus(await (kind === 'primary' ? setWorkerPrimary(id) : resetWorkerState(id)));
        if (kind === 'reset') setResetAt((m) => new Map([...m, [id, w.heartbeat_at]]));
        toast(kind === 'primary' ? `ตั้ง ${id} เป็นตัวหลักแล้ว` : `เริ่ม ${id} ใหม่แล้ว — รอบถัดไปจะทำงานต่อ`);
      } catch (e2) {
        toastError(e2);
      } finally {
        setBusyWorker('');
        setBusyKind('');
      }
    });
  }

  const label = (id: number) => {
    const r = known.get(id);
    return r ? roomLabel(r) : `ห้อง ${id}`;
  };

  return (
    <div className="panel" id="wk-panel">
      <div className="panel-h"><h2>Worker ส่งข้อความ</h2></div>
      <div className="panel-b">
        {err ? <div className="login-err">{err}</div> : null}
        {!status ? (
          <p className="help">{err ? '' : 'กำลังโหลดสถานะ worker…'}</p>
        ) : (
          <>
            {status.workers.length ? (
              status.workers.map((w) => {
                const on = isWorkerOnline(w);
                const badge = workerBadge(w);
                const role = workerRole(w, status.primary);
                const waiting = resetAt.has(w.worker_id) && resetAt.get(w.worker_id) === w.heartbeat_at;
                const canReset = w.worker_id === CLOUD_WORKER_ID && w.state === 'stopped' && !waiting;
                const isArmed = armed === w.worker_id;
                return (
                  <div key={w.worker_id} className="list-row" data-worker={w.worker_id}>
                    <span aria-hidden="true" style={{ width: 8, height: 8, borderRadius: '50%', flex: 'none', background: on ? 'var(--ok)' : 'var(--bad)' }} />
                    <div>
                      <b>{w.worker_id}</b>{role ? <> <span className="tag" data-role>{role}</span></> : null}{' '}
                      <span className="sub">{on ? 'ออนไลน์' : 'ออฟไลน์'} · ล่าสุด {stamp(w.heartbeat_at)}</span>
                      <div className="sub">
                        JST {w.jst_session_ok ? 'เชื่อมต่อแล้ว' : 'ยังไม่ได้ล็อกอิน'} · ส่งชั่วโมงนี้ {Number(w.sent_last_hour || 0).toLocaleString('th-TH')} · คิวรอ {Number(w.queue_waiting || 0).toLocaleString('th-TH')}
                      </div>
                      {badge.hint ? <div className="sub" style={{ color: 'var(--bad)' }}>{badge.hint}</div> : null}
                      {w.last_error ? <div className="sub" style={{ color: 'var(--bad)' }}>error ล่าสุด: {w.last_error}</div> : null}
                      {role === 'ตัวสำรอง' && covering ? <div className="sub">กำลังรับงานแทนตัวหลัก</div> : null}
                      {waiting ? <div className="sub">รอรอบถัดไป…</div> : null}
                      {role !== 'ตัวหลัก' || canReset ? (
                        <div className="toolbar" style={{ marginTop: 6 }}>
                          {role !== 'ตัวหลัก' ? (
                            <button type="button" className="btn sm" data-act="primary" disabled={!!busyWorker}
                              aria-label={`ตั้ง ${w.worker_id} เป็นตัวหลัก`}
                              onClick={() => void workerAction(w, 'primary')}>
                              {busyWorker === w.worker_id && busyKind === 'primary' ? 'กำลังตั้ง…' : isArmed ? `ยืนยัน: ให้ ${w.worker_id} ส่งข้อความแทนตัวอื่น` : 'ตั้งเป็นตัวหลัก'}
                            </button>
                          ) : null}
                          {canReset ? (
                            <button type="button" className="btn sm" data-act="reset" disabled={!!busyWorker}
                              aria-label={`เริ่ม ${w.worker_id} ใหม่`}
                              onClick={() => void workerAction(w, 'reset')}>
                              {busyWorker === w.worker_id && busyKind === 'reset' ? 'กำลังเริ่มใหม่…' : 'เริ่มใหม่'}
                            </button>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                    <span className={`badge plain ${badge.cls}`}>{badge.text}</span>
                  </div>
                );
              })
            ) : (
              <div className="empty" style={{ padding: 24 }}>ยังไม่มี worker ส่ง heartbeat เข้ามา</div>
            )}
            <p className="help" style={{ marginTop: 8 }}>
              คิวรอ {status.queue.queued.toLocaleString('th-TH')} · กำลังส่ง {status.queue.sending.toLocaleString('th-TH')} · ส่งชั่วโมงนี้ {status.queue.sent_last_hour.toLocaleString('th-TH')} · LINE เดือนนี้ {status.queue.line_sent_this_month.toLocaleString('th-TH')}
            </p>
          </>
        )}
        {form ? (
          <>
            <form id="wk-form" noValidate onSubmit={(e) => void onSave(e)} style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 12 }}>
              <div className="form-grid">
                <div className="field">
                  <label htmlFor="wk-interval">ระยะห่างระหว่างข้อความ (วินาที)</label>
                  <input className="input" id="wk-interval" type="number" min={5} max={3600} step={1} value={form.interval} disabled={saving} onChange={(e) => setForm((f) => f && { ...f, interval: e.target.value })} />
                </div>
                <div className="field">
                  <label htmlFor="wk-cap">เพดาน LINE ต่อเดือน (0 = ไม่จำกัด)</label>
                  <input className="input" id="wk-cap" type="number" min={0} step={1} value={form.lineCap} disabled={saving} onChange={(e) => setForm((f) => f && { ...f, lineCap: e.target.value })} />
                </div>
              </div>
              <label className="switch">
                <input type="checkbox" id="wk-test" checked={form.testMode} disabled={saving} onChange={(e) => setForm((f) => f && { ...f, testMode: e.target.checked })} />
                <span />
                โหมดทดสอบ (ส่งทุกข้อความไปห้องทดสอบแทนลูกค้าจริง)
              </label>
              <div>
                <div className="sub"><b>ห้องทดสอบ</b></div>
                {form.testMsIds.length ? (
                  <div className="toolbar" id="wk-rooms" style={{ marginTop: 6 }}>
                    {form.testMsIds.map((id) => (
                      <button key={id} type="button" className="chip active" data-room={id} title="กดเพื่อเอาออก" disabled={saving}
                        style={{ whiteSpace: 'normal', textAlign: 'left', maxWidth: '100%' }} onClick={() => setForm((f) => f && { ...f, testMsIds: toggleRoom(f.testMsIds, id) })}>
                        {label(id)} ✕
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="help">ยังไม่ได้เลือกห้องทดสอบ — โหมดทดสอบจะไม่ส่งข้อความใด ๆ</p>
                )}
              </div>
              {formErr ? <div className="login-err">{formErr}</div> : null}
              <div className="toolbar">
                <button className="btn primary" id="wk-save" disabled={saving}>{saving ? 'กำลังบันทึก…' : 'บันทึกการตั้งค่า'}</button>
              </div>
            </form>
            <form className="inline-form" id="wk-room-search" onSubmit={(e) => void onSearch(e)}>
              <input className="input" id="wk-room-q" type="search" placeholder="ค้นห้องทดสอบด้วยชื่อลูกค้าในแชต (อย่างน้อย 2 ตัวอักษร)" value={q} onChange={(e) => setQ(e.target.value)} />
              <button className="btn" disabled={searching}>{searching ? 'กำลังค้น…' : 'ค้นหา'}</button>
            </form>
            {rooms ? (
              rooms.length ? (
                <div id="wk-room-results" style={{ marginTop: 6 }}>
                  {rooms.map((r) => {
                    const on = form.testMsIds.includes(r.ms_id);
                    return (
                      <div key={r.ms_id} className="list-row" data-room-result={r.ms_id}>
                        <div>{roomLabel(r)}<div className="sub">ข้อความล่าสุด {stamp(r.last_time)}</div></div>
                        <button type="button" className={`btn sm${on ? ' danger' : ''}`} disabled={saving} onClick={() => setForm((f) => f && { ...f, testMsIds: toggleRoom(f.testMsIds, r.ms_id) })}>
                          {on ? 'เอาออก' : 'เพิ่ม'}
                        </button>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="help" style={{ marginTop: 6 }}>ไม่พบห้องที่ตรงกับคำค้น</p>
              )
            ) : null}
            <p className="help" style={{ marginTop: 10 }}>เลือกห้อง/เอาห้องออกแล้วกด บันทึกการตั้งค่า · โหมดทดสอบส่งทุกข้อความไปห้องทดสอบห้องแรก พร้อมคำนำหน้า [ทดสอบ → ชื่อลูกค้า]</p>
          </>
        ) : null}
      </div>
    </div>
  );
}
