/** toast ช่องเดียวของ prototype (L124-127): แสดง 2200 ms ข้อความใหม่เริ่มนับใหม่; dispose() เรียกตอน provider unmount */
export const TOAST_MS = 2200;

export interface Toaster {
  toast: (msg: string) => void;
  dispose: () => void;
}

export function createToaster(show: (msg: string | null) => void, ms: number = TOAST_MS): Toaster {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return {
    toast(msg) {
      show(msg);
      clearTimeout(timer);
      timer = setTimeout(() => show(null), ms);
    },
    dispose() {
      clearTimeout(timer);
      timer = undefined;
    },
  };
}
