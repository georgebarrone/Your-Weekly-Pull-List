# Installs a per-user Windows Task Scheduler job. Run from a PowerShell
# terminal in this repository after local .env and browser login are set up.
$ErrorActionPreference = 'Stop'
$repo = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$node = (Get-Command node -ErrorAction Stop).Source
$entry = Join-Path $repo 'scripts\pdf-weekly.js'
$task = 'Your Weekly Pull List - PDF Delivery'
$action = New-ScheduledTaskAction -Execute $node -Argument ('"' + $entry + '"') -WorkingDirectory $repo
$trigger = New-ScheduledTaskTrigger -Weekly -DaysOfWeek Wednesday -At '1:35PM'
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -WakeToRun -ExecutionTimeLimit (New-TimeSpan -Hours 3)
$user = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name
$principal = New-ScheduledTaskPrincipal -UserId $user -LogonType Interactive -RunLevel Limited
Register-ScheduledTask -TaskName $task -Action $action -Trigger $trigger -Settings $settings -Principal $principal -Force | Out-Null
Write-Host "Task registered: $task"
Write-Host 'Runs Wednesdays at 1:35 PM in the PC local time zone, when your Windows user is signed in.'
Write-Host 'PC should use Pacific Time (America/Los_Angeles) for the intended schedule.'
Write-Host "Time zone: $((Get-TimeZone).Id)"
Write-Host "Check it with: Get-ScheduledTask -TaskName '$task'"
