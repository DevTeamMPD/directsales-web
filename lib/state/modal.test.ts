import { describe, expect, it } from 'vitest';
import { closeModalState } from './modal';

const m = { node: null, cls: '', seq: 3 };

describe('closeModalState', () => {
  it('closes unconditionally without a seq (Esc / backdrop / close button)', () => {
    expect(closeModalState(m)).toBeNull();
    expect(closeModalState(null)).toBeNull();
  });
  it('closes only when the modal that asked is still the current one', () => {
    expect(closeModalState(m, 3)).toBeNull();
    expect(closeModalState(m, 2)).toBe(m);
    expect(closeModalState(null, 2)).toBeNull();
  });
});
