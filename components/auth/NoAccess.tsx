'use client';

export const LOADING_TEXT = 'กำลังโหลดข้อมูล…';
export const NO_ACCESS_TEXT = 'ยังไม่มีสิทธิ์ใช้งาน ติดต่อหัวหน้า';
export const INACTIVE_TEXT = 'บัญชีนี้ถูกปิดใช้งาน ติดต่อหัวหน้า';
export const EXPIRED_TEXT = 'หมดเวลาการเข้าสู่ระบบ กรุณาเข้าสู่ระบบใหม่';

interface Props {
  message: string;
  email?: string;
  isError?: boolean;
  onRetry?: () => void;
  onLogout?: () => void;
  /** ข้อความปุ่ม onLogout (session หมดอายุ = "เข้าสู่ระบบใหม่") */
  logoutText?: string;
}

export function NoAccess({ message, email, isError = false, onRetry, onLogout, logoutText = 'ออกจากระบบ' }: Props) {
  return (
    <div className="login" id="no-access">
      <div className="login-card">
        <div className="brand-name">MPD Direct Sale</div>
        {isError ? <div className="login-err" role="alert">{message}</div> : <p className="help">{message}</p>}
        {email ? <p className="help">บัญชีที่ใช้อยู่: {email}</p> : null}
        {onRetry ? <button className="btn primary" type="button" onClick={onRetry}>ลองใหม่</button> : null}
        {onLogout ? (
          <button className={onRetry ? 'btn' : 'btn primary'} type="button" id="logout" onClick={onLogout}>{logoutText}</button>
        ) : null}
      </div>
    </div>
  );
}
