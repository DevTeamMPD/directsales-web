/** เนื้อหาชั่วคราวของหน้าที่ยังไม่ย้าย (แผน B / C) */
export function Placeholder({ plan }: { plan: 'B' | 'C' }) {
  return (
    <div className="card">
      <p className="empty">หน้านี้จะย้ายจาก prototype ในแผน {plan}</p>
    </div>
  );
}
