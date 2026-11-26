# Installs the Windows scheduled task "JST Outreach Worker" for the current user (no admin needed).
#   - starts run-worker.cmd at logon, and checks every 15 minutes: if the worker is not running
#     (window closed, crashed, machine woke up from sleep) the task starts it again
#   - WakeToRun: the 15-minute check may wake the PC from sleep (if wake timers are allowed)
#   - -KeepAwake: also sets this PC to never sleep / hibernate while plugged in (powercfg)
# Usage (PowerShell, in tools\jst-worker):
#   powershell -ExecutionPolicy Bypass -File .\install-task.ps1 -KeepAwake
#   powershell -ExecutionPolicy Bypass -File .\install-task.ps1 -Remove
param([switch]$KeepAwake, [switch]$Remove)
$ErrorActionPreference = 'Stop'
$name = 'JST Outreach Worker'
$dir = $PSScriptRoot
$cmd = Join-Path $dir 'run-worker.cmd'

if ($Remove) {
  Stop-ScheduledTask -TaskName $name -ErrorAction SilentlyContinue
  Unregister-ScheduledTask -TaskName $name -Confirm:$false
  Write-Host "Removed task '$name'. Close the worker window if it is still open."
  return
}

if (-not (Test-Path (Join-Path $dir 'config.json'))) { throw "config.json not found in $dir - set up the worker first (README.md)" }
if (-not (Get-Command node -ErrorAction SilentlyContinue)) { throw 'node is not on PATH' }

$user = "$env:USERDOMAIN\$env:USERNAME"
$action = New-ScheduledTaskAction -Execute 'cmd.exe' -Argument "/c `"$cmd`"" -WorkingDirectory $dir
$triggers = @(
  (New-ScheduledTaskTrigger -AtLogOn -User $user),
  (New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(1) -RepetitionInterval (New-TimeSpan -Minutes 15))
)
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable `
  -WakeToRun -MultipleInstances IgnoreNew -ExecutionTimeLimit ([TimeSpan]::Zero) `
  -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1)
$principal = New-ScheduledTaskPrincipal -UserId $user -LogonType Interactive -RunLevel Limited
Register-ScheduledTask -TaskName $name -Action $action -Trigger $triggers -Settings $settings -Principal $principal `
  -Description 'MPD Direct Sale - JST outreach worker (tools\jst-worker\run-worker.cmd)' -Force | Out-Null
Write-Host "Installed task '$name' (at logon + every 15 minutes if not running)."

if ($KeepAwake) {
  powercfg /change standby-timeout-ac 0
  powercfg /change hibernate-timeout-ac 0
  Write-Host 'Sleep and hibernate on AC power: never.'
}

Start-ScheduledTask -TaskName $name
Write-Host 'Started. A "JST Outreach Worker" window should open - leave it open (closing it = the task starts it again within 15 minutes).'
