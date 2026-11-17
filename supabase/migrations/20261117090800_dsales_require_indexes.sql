-- dsales_refresh_customer_base() join sales_transaction ด้วย btrim(bill_no) / btrim(order_no)
-- ซึ่งพึ่ง index สองตัวนี้บน public.sales_transaction (ไม่มี migration ของเราสร้างให้ — เป็นของระบบอื่น)
-- ถ้าไม่มี index การ refresh จะช้าจนเหมือนค้าง จึงตรวจให้ migration ล้มก่อนแทน
-- This migration creates nothing: it only asserts the indexes exist so the refresh can't silently hang.
do $$
begin
  if to_regclass('public.ix_sales_transaction_bill_no_btrim') is null then
    raise exception 'ไม่พบ index public.ix_sales_transaction_bill_no_btrim (partial, on btrim(bill_no)) ที่ dsales_refresh_customer_base() ต้องใช้ / missing required index public.ix_sales_transaction_bill_no_btrim';
  end if;
  if to_regclass('public.ix_sales_transaction_order_no_btrim') is null then
    raise exception 'ไม่พบ index public.ix_sales_transaction_order_no_btrim (on btrim(order_no)) ที่ dsales_refresh_customer_base() ต้องใช้ / missing required index public.ix_sales_transaction_order_no_btrim';
  end if;
end $$;
