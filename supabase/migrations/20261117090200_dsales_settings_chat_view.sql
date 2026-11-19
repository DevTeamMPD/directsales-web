-- ค่าตั้งของ Direct Sale + view ข้อความแชต JST ที่แก้เวลาแล้ว (iim_messages.time บันทึกเวลาไทยเป็น UTC จึงเร็วไป 7 ชม.)
create table if not exists dsales.dsales_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);
insert into dsales.dsales_settings (key, value) values
  ('dormant_days', '30'),
  ('window_days', '30'),
  ('worker_rate_per_hour', '60'),
  ('chat_tz_offset', '"7 hours"')
on conflict (key) do nothing;

create or replace view dsales.dsales_chat_messages_v as
select m.id, m.ms_id,
       m.time - (select (s.value #>> '{}')::interval from dsales.dsales_settings s where s.key = 'chat_tz_offset') as time,
       m.time as raw_time, m.dir, m.fmt, m.text, m.sender
from public.iim_messages m;

revoke all on dsales.dsales_settings, dsales.dsales_chat_messages_v from anon, authenticated;
