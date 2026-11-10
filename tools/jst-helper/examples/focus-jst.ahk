; ตัวอย่าง AutoHotkey v2 (Windows) — ปรับให้ตรงกับหน้าจอ JST ของคุณก่อนใช้
; config.json:
;   "mode": "command",
;   "command": ["C:\\Program Files\\AutoHotkey\\v2\\AutoHotkey64.exe", "C:\\jst-helper\\examples\\focus-jst.ahk", "{chat}"]
chat := A_Args.Length ? A_Args[1] : ""
if (chat = "")
    ExitApp
; หน้าต่าง JST (เปลี่ยนชื่อ/ชื่อโปรแกรมให้ตรง)
if !WinExist("ahk_exe JST.exe")
    ExitApp
WinActivate
WinWaitActive(, , 2)
A_Clipboard := chat          ; คัดลอกชื่อแชตไปวางในช่องค้นหาแชตของ JST
Sleep 200
Send "^f"                    ; (ตัวอย่าง) โฟกัสช่องค้นหา — ปรับปุ่มลัดตาม JST
Sleep 150
Send "^v{Enter}"
