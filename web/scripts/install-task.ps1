# Task Scheduler 에 'GTVS Dashboard' 등록 (사용자 본인 계정, 로그인 시 자동 시작)
param()

$TaskName = 'GTVS Dashboard'
$userId = "$env:USERDOMAIN\$env:USERNAME"

# 기존 Task 있으면 안전하게 제거 후 재등록
$existing = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
if ($existing) {
    Write-Host "[info] removing existing task before re-register" -ForegroundColor Yellow
    Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
}

$action = New-ScheduledTaskAction -Execute 'wscript.exe' -Argument '"C:\GTVS\dashboard\web\scripts\start-prod.vbs"'
$trigger = New-ScheduledTaskTrigger -AtLogon -User $userId
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -ExecutionTimeLimit (New-TimeSpan -Days 0) -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1)

Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Settings $settings -User $userId -RunLevel Limited -Description 'GTVS Dashboard production server (next start) at user logon' | Out-Null

Write-Host "[ok] Task '$TaskName' registered for user $userId" -ForegroundColor Green
Get-ScheduledTask -TaskName $TaskName | Select-Object TaskName, State
