'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';

export default function LoginForm() {
  const router = useRouter();
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const email = String(form.get('email') ?? '').trim();
    const password = String(form.get('password') ?? '');
    setBusy(true);
    setErr('');
    try {
      const { data, error } = await supabase().auth.signInWithPassword({ email, password });
      setBusy(false);
      if (error || !data?.user) {
        setErr('อีเมลหรือรหัสผ่านไม่ถูกต้อง');
        return;
      }
    } catch {
      setBusy(false);
      setErr('โหลดระบบล็อกอินไม่สำเร็จ ตรวจสอบอินเทอร์เน็ตแล้วลองใหม่');
      return;
    }
    router.replace('/leads');
    router.refresh();
  }

  return (
    <div className="login" id="login">
      <form className="login-card" id="login-form" onSubmit={onSubmit}>
        <div className="brand-name">MPD Direct Sale</div>
        <p className="help">เข้าสู่ระบบด้วยอีเมลและรหัสผ่านที่ลงทะเบียนไว้ใน Supabase</p>
        <div className="field">
          <label htmlFor="l-email">อีเมล</label>
          <input className="input" id="l-email" name="email" type="email" autoComplete="username" required />
        </div>
        <div className="field">
          <label htmlFor="l-pass">รหัสผ่าน</label>
          <input className="input" id="l-pass" name="password" type="password" autoComplete="current-password" required />
        </div>
        <div className="login-err" id="l-err" role="alert" hidden={!err}>{err}</div>
        <button className="btn primary" id="l-submit" disabled={busy}>เข้าสู่ระบบ</button>
      </form>
    </div>
  );
}
