/**
 * แปลงคำค้นที่เป็นเบอร์ (+66 / 66 / ขีด / ช่องว่าง / วงเล็บ) เป็นรูป 0xxxxxxxxx ตามกติกาเดียวกับ dsales.dsales_norm_phone
 * คำค้นที่มีตัวอักษรอื่น (ชื่อ, ชื่อแชต, เลขบิลที่มีตัวอักษร) คืนค่าเดิมที่ trim แล้ว
 */
export function normalizeSearchPhone(q: string): string {
  const t = q.trim();
  if (!t || !/^[0-9+\-\s().]+$/.test(t)) return t;
  const d = t.replace(/\D/g, '');
  if (/^660?\d{9}$/.test(d)) return '0' + d.slice(-9);
  if (/^[689]\d{8}$/.test(d)) return '0' + d;
  return d;
}
