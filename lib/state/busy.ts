/**
 * กันกดซ้ำ (double-click) ระหว่างรอ RPC: key เดียวกันทำได้ทีละครั้ง ครั้งที่ซ้อนเข้ามาคืน undefined ทันที (ไม่เรียก fn)
 * AppProvider สร้าง 1 ตัวต่อแอป (`actions.once`) ใช้กับปุ่ม จอง / มอบหมาย / ยกเลิกห้ามโทร / จองจากถัง / สร้างแคมเปญ ฯลฯ
 */
export interface BusyGuard {
  run<T>(key: string, fn: () => Promise<T>): Promise<T | undefined>;
  has(key: string): boolean;
}

export function createBusyGuard(): BusyGuard {
  const keys = new Set<string>();
  return {
    async run(key, fn) {
      if (keys.has(key)) return undefined;
      keys.add(key);
      try {
        return await fn();
      } finally {
        keys.delete(key);
      }
    },
    has: (key) => keys.has(key),
  };
}
