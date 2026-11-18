import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// Next แทน process.env.* ที่เขียนตรงตัวด้วยค่าตอน build (production → "production" / undefined)
// webpack จึงตัดทิ้งทั้ง if และ dynamic import ของ fixture — เงื่อนไขต้องเขียนแบบนี้เท่านั้น ห้ามย้ายไปเป็นตัวแปร/ฟังก์ชัน
const GUARD = "process.env.NODE_ENV === 'development' && process.env.NEXT_PUBLIC_FIXTURES === '1'";

describe('fixture mode stays out of production builds', () => {
  it('every NEXT_PUBLIC_FIXTURES check is the literal dev-only guard', () => {
    for (const file of ['middleware.ts', 'lib/state/AppProvider.tsx']) {
      const src = readFileSync(file, 'utf8');
      const uses = src.split('NEXT_PUBLIC_FIXTURES').length - 1;
      expect(uses, file).toBeGreaterThan(0);
      expect(src.split(GUARD).length - 1, file).toBe(uses);
    }
  });
  it('fixture data is reached only by a dynamic import inside the guard', () => {
    const src = readFileSync('lib/state/AppProvider.tsx', 'utf8');
    expect(src).not.toMatch(/^import[^\n]*lib\/fixtures/m);
    const at = src.indexOf("import('@/lib/fixtures/load')");
    expect(at).toBeGreaterThan(-1);
    const guardAt = src.lastIndexOf(GUARD, at);
    expect(guardAt).toBeGreaterThan(-1);
    expect(at - guardAt).toBeLessThan(200);
    const offenders = ['app', 'components', 'lib']
      .flatMap((dir) => (readdirSync(dir, { recursive: true }) as string[]).map((f) => join(dir, f)))
      .filter((f) => /\.tsx?$/.test(f) && !f.includes('fixtures') && !f.endsWith('.test.ts') && !f.endsWith('AppProvider.tsx'))
      .filter((f) => readFileSync(f, 'utf8').includes('lib/fixtures'));
    expect(offenders).toEqual([]);
  });
});
