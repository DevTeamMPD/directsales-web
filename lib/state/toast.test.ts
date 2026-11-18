import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createToaster, TOAST_MS } from './toast';

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

describe('createToaster (prototype toast L124-127)', () => {
  it('shows the message and hides it after 2200 ms', () => {
    const show = vi.fn();
    const t = createToaster(show);
    t.toast('บันทึกแล้ว');
    expect(show).toHaveBeenLastCalledWith('บันทึกแล้ว');
    vi.advanceTimersByTime(TOAST_MS - 1);
    expect(show).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(1);
    expect(show).toHaveBeenLastCalledWith(null);
    expect(TOAST_MS).toBe(2200);
  });
  it('a new toast restarts the timer', () => {
    const show = vi.fn();
    const t = createToaster(show);
    t.toast('a');
    vi.advanceTimersByTime(2000);
    t.toast('b');
    vi.advanceTimersByTime(2000);
    expect(show).toHaveBeenLastCalledWith('b');
    vi.advanceTimersByTime(200);
    expect(show).toHaveBeenLastCalledWith(null);
  });
  it('dispose cancels the pending hide (provider unmount)', () => {
    const show = vi.fn();
    const t = createToaster(show);
    t.toast('a');
    t.dispose();
    vi.advanceTimersByTime(5000);
    expect(show).toHaveBeenCalledTimes(1);
  });
});
