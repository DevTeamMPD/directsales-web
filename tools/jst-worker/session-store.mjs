// ที่เก็บ cookie ของ JST — แบบไฟล์ (.session.json บนเครื่อง worker) และแบบหน่วยความจำ (โหมดรอบบน Vercel)
// store = { load(): [{name, value}], save(cookies), mtime(): number }
import { existsSync, readFileSync, renameSync, statSync, writeFileSync } from 'node:fs';

const isCookie = (c) => c && typeof c === 'object' && typeof c.name === 'string' && typeof c.value === 'string';

/** เหลือเฉพาะคู่ {name, value} ที่เป็นข้อความ */
export const cleanCookies = (list) => (Array.isArray(list) ? list.filter(isCookie).map((c) => ({ name: c.name, value: c.value })) : []);

export function fileStore(path) {
  return {
    load() {
      if (!path || !existsSync(path)) return [];
      try {
        return cleanCookies(JSON.parse(readFileSync(path, 'utf8')));
      } catch {
        return [];
      }
    },
    save(cookies) {
      const tmp = `${path}.tmp`;
      writeFileSync(tmp, JSON.stringify(cleanCookies(cookies), null, 2), { mode: 0o600 });
      renameSync(tmp, path);
    },
    mtime() {
      try {
        return statSync(path).mtimeMs;
      } catch {
        return 0;
      }
    },
  };
}

/** dirty = มีการ save หลังสร้าง (ใช้ตัดสินว่าต้องเขียน cookie กลับ DB หรือไม่) */
export function memoryStore(initial = []) {
  let cookies = cleanCookies(initial);
  let dirty = false;
  return {
    load: () => cookies.map((c) => ({ ...c })),
    save(next) {
      const cleaned = cleanCookies(next);
      if (JSON.stringify(cleaned) !== JSON.stringify(cookies)) dirty = true;
      cookies = cleaned;
    },
    mtime: () => 0,
    cookies: () => cookies.map((c) => ({ ...c })),
    get dirty() {
      return dirty;
    },
  };
}
