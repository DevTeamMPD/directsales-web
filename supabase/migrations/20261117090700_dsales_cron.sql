-- ทุกชั่วโมง นาทีที่ 5: ผูกห้องแชตใหม่ด้วยชื่อแชต แล้วคำนวณฐานลูกค้าใหม่
select cron.schedule(
  'dsales-refresh-customer-base',
  '5 * * * *',
  $$select dsales.dsales_seed_chat_links_by_name(); select dsales.dsales_refresh_customer_base();$$
);
