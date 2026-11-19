-- ดึงนิยาม function public.dsales_* ทั้งหมดเป็นข้อความเดียว (คอลัมน์ sql) เรียงตามชื่อ
select string_agg(
         '-- FUNCTION: ' || p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')' || E'\n'
         || pg_get_functiondef(p.oid) || ';',
         E'\n' order by p.proname, pg_get_function_identity_arguments(p.oid)) as sql
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname like 'dsales\_%';
