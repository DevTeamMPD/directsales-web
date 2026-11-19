-- Task 1b (ต่อ): TRUNCATE ข้าม RLS จึงต้องไม่เปิดให้ authenticated/anon; คง select/insert/update/delete ให้ RLS คุม
revoke truncate, trigger, references on dsales.dsales_leads, dsales.dsales_interactions, dsales.dsales_campaigns
  from authenticated, anon;

-- dsales_members แก้ผ่าน definer RPC เท่านั้น (ตัดสิทธิ์เขียนไปแล้วใน 20261117100100) policy นี้จึงไม่มีผล
drop policy dsales_members_write on dsales.dsales_members;
