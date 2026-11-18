import type { ReactNode } from 'react';

export interface ModalState { node: ReactNode; cls: string; seq: number }

/** state ถัดไปหลัง closeModal(seq?): ไม่ระบุ seq = ปิดเสมอ; ระบุ seq = ปิดเฉพาะเมื่อ popup ปัจจุบันยังเป็นอันที่เรียก (กัน RPC ที่ตอบช้าไปปิด popup ใหม่) */
export const closeModalState = (m: ModalState | null, seq?: number): ModalState | null => (seq === undefined || m?.seq === seq ? null : m);
