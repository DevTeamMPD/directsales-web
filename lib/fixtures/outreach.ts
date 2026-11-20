import type { OutreachDemo } from '@/lib/api/types';

/**
 * ข้อมูลตัวอย่างของการส่งข้อความผ่าน JST worker (โหมด fixture เท่านั้น — เขียนมือ ไม่ได้มาจาก legacy/data.js เพราะ prototype ไม่มีหน้านี้)
 * เบอร์/ชื่อตรงกับลูกค้าตัวอย่างใน data.ts, เวลาเป็นวันที่ 2026-11-04 (วันนี้ของโหมด fixture)
 */
export const FIXTURE_OUTREACH: OutreachDemo = {
  templates: [
    {
      id: 'tpl-bebe-1', brand: 'bebeplay', name: 'ทักลูกค้าเก่า 6 เดือน', active: true, updated_at: '2026-11-03T03:00:00Z',
      body: 'สวัสดีค่ะ {ชื่อ} 😊 แอดมิน {ร้าน} เองค่ะ\nเห็นว่าเคยสั่ง {สินค้าล่าสุด} ไว้ ตอนนี้มีโปรสำหรับลูกค้าเดิม ลด 10% สนใจดูรายละเอียดไหมคะ',
    },
    {
      id: 'tpl-bebe-2', brand: 'bebeplay', name: 'โปรเตียงเด็ก (ปิดแล้ว)', active: false, updated_at: '2026-10-20T03:00:00Z',
      body: 'สวัสดีค่ะ {ชื่อ} โปรเตียงเด็กเดือนนี้ลดพิเศษค่ะ',
    },
    {
      id: 'tpl-host-1', brand: 'hosttail', name: 'ทาสแมวกลับมาซื้อ', active: true, updated_at: '2026-11-02T03:00:00Z',
      body: 'สวัสดีครับ {ชื่อ} จาก {ร้าน} ครับ น้อง ๆ ใช้ {สินค้าล่าสุด} เป็นยังไงบ้างครับ ตอนนี้มีทรายแมวแถมถุงขยะครับ',
    },
  ],
  batches: [
    {
      id: 'ob-demo-1', created_at: '2026-11-04T02:15:00Z', brand: 'bebeplay', requested_by: 'r4', template_name: 'ทักลูกค้าเก่า 6 เดือน',
      total: 6, skipped: 1, counts: { queued: 1, sending: 1, sent: 2, failed: 1, cancelled: 0 },
    },
    {
      id: 'ob-demo-2', created_at: '2026-11-03T07:40:00Z', brand: 'hosttail', requested_by: 'r1', template_name: 'ทาสแมวกลับมาซื้อ',
      total: 2, skipped: 0, counts: { queued: 0, sending: 0, sent: 1, failed: 0, cancelled: 1 },
    },
  ],
  details: {
    'ob-demo-1': {
      batch: {
        id: 'ob-demo-1', created_at: '2026-11-04T02:15:00Z', brand: 'bebeplay', template_name: 'ทักลูกค้าเก่า 6 เดือน', total: 6,
        skipped: [{ phone: '0866082887', reason: 'no_chat_room' }], requested_by: 'r4',
      },
      items: [
        {
          id: 'oq-1', phone: '0864355692', lead_id: null, ms_id: 910001, page: 'bebeplayspace', provider: 'Line', chat_name: 'baby_love100_loa',
          message: 'สวัสดีค่ะ ธนากร รุ่งเรือง 😊 แอดมิน bebeplayspace เองค่ะ', status: 'sent', attempts: 1, error: null,
          enqueued_at: '2026-11-04T02:15:00Z', sent_at: '2026-11-04T02:16:05Z',
        },
        {
          id: 'oq-2', phone: '0892740809', lead_id: null, ms_id: 910002, page: 'SH_bebeplay', provider: 'Shopee', chat_name: 'nong_mint101_sh',
          message: 'สวัสดีค่ะ รัชนี แสงทอง 😊 แอดมิน SH_bebeplay เองค่ะ', status: 'sent', attempts: 1, error: null,
          enqueued_at: '2026-11-04T02:15:00Z', sent_at: '2026-11-04T02:17:10Z',
        },
        {
          id: 'oq-3', phone: '0954729320', lead_id: null, ms_id: 910003, page: 'SH_bebeplay', provider: 'Shopee', chat_name: 'mom_ploy103_sh',
          message: 'สวัสดีค่ะ พิมพ์ชนก มั่นคง 😊 แอดมิน SH_bebeplay เองค่ะ', status: 'sending', attempts: 1, error: null,
          enqueued_at: '2026-11-04T02:15:00Z', sent_at: null,
        },
        {
          id: 'oq-4', phone: '0924363271', lead_id: null, ms_id: 910004, page: 'Bebeplay', provider: 'Facebook', chat_name: 'pet_home104_sh',
          message: 'สวัสดีค่ะ สมศักดิ์ พงษ์ไทย 😊 แอดมิน Bebeplay เองค่ะ', status: 'failed', attempts: 1, error: 'window_closed',
          enqueued_at: '2026-11-04T02:15:00Z', sent_at: null,
        },
        {
          id: 'oq-5', phone: '0647768140', lead_id: null, ms_id: 910005, page: 'SH_bebeplay', provider: 'Shopee', chat_name: 'happy_mom107_sh',
          message: 'สวัสดีค่ะ ศิริพร เจริญผล 😊 แอดมิน SH_bebeplay เองค่ะ', status: 'queued', attempts: 0, error: null,
          enqueued_at: '2026-11-04T02:15:00Z', sent_at: null,
        },
      ],
    },
    'ob-demo-2': {
      batch: {
        id: 'ob-demo-2', created_at: '2026-11-03T07:40:00Z', brand: 'hosttail', template_name: 'ทาสแมวกลับมาซื้อ', total: 2, skipped: [], requested_by: 'r1',
      },
      items: [
        {
          id: 'oq-6', phone: '0865907646', lead_id: null, ms_id: 920001, page: 'Host Tail', provider: 'Line', chat_name: 'mom_ploy105_loa',
          message: 'สวัสดีครับ ขวัญใจ ศรีสุข จาก Host Tail ครับ', status: 'sent', attempts: 1, error: null,
          enqueued_at: '2026-11-03T07:40:00Z', sent_at: '2026-11-03T07:41:00Z',
        },
        {
          id: 'oq-7', phone: '0927636213', lead_id: null, ms_id: 920002, page: 'SH_hosttail', provider: 'Shopee', chat_name: 'little_star102_sh',
          message: 'สวัสดีครับ พีรพัฒน์ สุขสวัสดิ์ จาก SH_hosttail ครับ', status: 'cancelled', attempts: 0, error: null,
          enqueued_at: '2026-11-03T07:40:00Z', sent_at: null,
        },
      ],
    },
  },
  worker: {
    workers: [
      {
        worker_id: 'office-pc-1', state: 'running', jst_session_ok: true, heartbeat_at: '2026-11-04T02:20:00Z', online: true,
        sent_last_hour: 2, queue_waiting: 2, last_error: null,
      },
    ],
    queue: { queued: 1, sending: 1, sent_last_hour: 2, line_sent_this_month: 14 },
    settings: { interval_seconds: 60, line_monthly_cap: 0, test_mode: true, test_ms_ids: [900001], max_batch: 50 },
  },
  rooms: [
    { ms_id: 900001, customer: 'Dev MPD', channel: 'Line', page: 'bebeplayspace', last_time: '2026-11-04T01:00:00Z' },
    { ms_id: 900002, customer: 'Dev MPD', channel: 'Facebook', page: 'Bebeplay', last_time: '2026-11-03T01:00:00Z' },
    { ms_id: 910001, customer: 'ธนากร รุ่งเรือง', channel: 'Line', page: 'bebeplayspace', last_time: '2026-11-04T02:16:05Z' },
  ],
};
