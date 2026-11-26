// คุยกับ Supabase (schema dsales) ด้วยบัญชี worker — RPC ตามสัญญา §2 (worker)
// ไม่ใช้ service_role · ไม่แตะตารางตรง ๆ เรียกผ่าน RPC เท่านั้น

export class QueueError extends Error {
  constructor(message) {
    super(message);
    this.name = 'QueueError';
  }
}

/**
 * autoRefreshToken: true = office loop (supabase-js renews the token itself)
 * false = per-tick mode on Vercel (no timer between runs) -> sign in again when the token is older than maxSessionAgeMs (tokens last 1h)
 */
export function createQueueClient({
  supabaseUrl, anonKey, email, password, createClient,
  autoRefreshToken = true, now = () => Date.now(), maxSessionAgeMs = 45 * 60_000,
}) {
  if (typeof createClient !== 'function') throw new Error('createClient is required');
  if (!supabaseUrl || !anonKey) throw new Error('supabase url / anonKey missing');
  const client = createClient(supabaseUrl, anonKey, {
    db: { schema: 'dsales' },
    auth: { persistSession: false, autoRefreshToken },
  });
  let signedIn = null; // Promise ของการล็อกอินที่สำเร็จ
  let signedInAt = 0;

  function ensureAuth() {
    if (signedIn && !autoRefreshToken && now() - signedInAt > maxSessionAgeMs) signedIn = null;
    if (!signedIn) {
      signedIn = (async () => {
        if (!email || !password) throw new QueueError('supabase: worker email/password missing');
        const { data, error } = await client.auth.signInWithPassword({ email, password });
        if (error) throw new QueueError(`supabase sign-in: ${error.message}`);
        signedInAt = now();
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
    /** รหัสผู้ซื้อที่ต้องค้นห้องใน JST → [{ buyer_id, shop_prefix }] */
    async linkTargets(workerId, limit) {
      const data = await rpc('dsales_worker_link_targets', { p_worker: workerId, p_limit: limit });
      return Array.isArray(data) ? data : [];
    },
    /** บันทึกผลค้น (ห้องของรหัสนั้น หรือ error) → จำนวนคู่ห้อง-เบอร์ที่ผูก */
    async linkSave(workerId, buyerId, rooms, error = null) {
      const data = await rpc('dsales_worker_link_save', {
        p_worker: workerId,
        p_buyer_id: buyerId,
        p_rooms: Array.isArray(rooms) ? rooms : [],
        p_error: error ?? null,
      });
      return Number(data) || 0;
    },
    /** Start a run: null = another run holds the lease, else { runtime, cookies } */
    async stateBegin(workerId, leaseSeconds = 90) {
      const data = await rpc('dsales_worker_state_begin', { p_worker: workerId, p_lease_seconds: leaseSeconds });
      return data ?? null;
    },
    /** End a run: save runtime; cookies = null means unchanged */
    async stateEnd(workerId, runtime, cookies = null) {
      await rpc('dsales_worker_state_end', { p_worker: workerId, p_runtime: runtime ?? {}, p_cookies: cookies ?? null });
    },
    /** Upload a session someone logged in by hand (import-session.mjs --upload) */
    async sessionPut(workerId, cookies) {
      await rpc('dsales_worker_session_put', { p_worker: workerId, p_cookies: cookies });
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
