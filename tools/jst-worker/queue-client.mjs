// คุยกับ Supabase (schema dsales) ด้วยบัญชี worker — RPC ตามสัญญา §2 (worker)
// ไม่ใช้ service_role · ไม่แตะตารางตรง ๆ เรียกผ่าน RPC เท่านั้น

export class QueueError extends Error {
  constructor(message) {
    super(message);
    this.name = 'QueueError';
  }
}

export function createQueueClient({ supabaseUrl, anonKey, email, password, createClient }) {
  if (typeof createClient !== 'function') throw new Error('createClient is required');
  if (!supabaseUrl || !anonKey) throw new Error('supabase url / anonKey missing');
  const client = createClient(supabaseUrl, anonKey, {
    db: { schema: 'dsales' },
    auth: { persistSession: false, autoRefreshToken: true },
  });
  let signedIn = null; // Promise ของการล็อกอินที่สำเร็จ

  function ensureAuth() {
    if (!signedIn) {
      signedIn = (async () => {
        if (!email || !password) throw new QueueError('supabase: worker email/password missing');
        const { data, error } = await client.auth.signInWithPassword({ email, password });
        if (error) throw new QueueError(`supabase sign-in: ${error.message}`);
        return data;
      })().catch((e) => {
        signedIn = null; // ลองใหม่รอบหน้า
        throw e instanceof QueueError ? e : new QueueError(`supabase sign-in: ${e?.message || e}`);
      });
    }
    return signedIn;
  }

  async function rpc(name, args) {
    await ensureAuth();
    let res;
    try {
      res = await client.rpc(name, args);
    } catch (e) {
      throw new QueueError(`${name}: ${e?.message || e}`);
    }
    if (res.error) {
      const msg = res.error.message || String(res.error);
      // token หมดอายุ/ไม่ถูกต้อง → ล็อกอินใหม่รอบหน้า
      if (/jwt|token|not authenticated/i.test(msg)) signedIn = null;
      throw new QueueError(`${name}: ${msg}`);
    }
    return res.data;
  }

  return {
    signIn: ensureAuth,
    /** null หรือ {id, ms_id, target_ms_id, test_redirect, page, provider, chat_name, message, attempts, enqueued_at, requested_by} */
    async claim(workerId) {
      const data = await rpc('dsales_worker_claim', { p_worker: workerId });
      return data ?? null;
    },
    async report(id, status, error = null, jstMsgId = null) {
      await rpc('dsales_worker_report', {
        p_id: id,
        p_status: status,
        p_error: error ?? null,
        p_jst_msg_id: jstMsgId == null ? null : String(jstMsgId),
      });
    },
    async heartbeat(workerId, state, sessionOk, lastError = null) {
      await rpc('dsales_worker_heartbeat', {
        p_worker: workerId,
        p_state: state,
        p_session_ok: sessionOk,
        p_last_error: lastError ?? null,
      });
    },
  };
}
