'use client';

import { useEffect, useRef } from 'react';
import { useActions, useModalState } from '@/lib/state/AppProvider';

/** popup ตาม prototype openModal/closeModal (L385-393): mousedown ที่พื้นหลัง, Esc, [data-close] ปิด; เปิดแล้ว focus ช่องแรก */
export function ModalRoot() {
  const modal = useModalState();
  const { closeModal } = useActions();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!modal) return;
    ref.current?.querySelector<HTMLElement>('input,select,textarea,button.btn')?.focus();
  }, [modal]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeModal();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [closeModal]);

  return (
    <div
      className="modal-root"
      id="modal-root"
      hidden={!modal}
      ref={ref}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) closeModal();
      }}
      onClick={(e) => {
        if ((e.target as HTMLElement).closest('[data-close]')) closeModal();
      }}
    >
      {modal ? (
        <div key={modal.seq} className={`modal ${modal.cls}`.trim()} role="dialog" aria-modal="true">
          {modal.node}
        </div>
      ) : null}
    </div>
  );
}
