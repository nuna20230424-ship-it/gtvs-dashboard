# GTVS Dashboard - 자동시작 Task 를 잠시 중단하고 dev 작업 모드로 전환
param()

$TaskName = 'GTVS Dashboard'

Write-Host "[1/2] disable scheduled task..." -ForegroundColor Cyan
try { Disable-ScheduledTask -TaskName $TaskName -ErrorAction Stop | Out-Null } catch {
    Write-Host "  disable failed: $($_.Exception.Message)" -ForegroundColor Yellow
}

Write-Host "[2/2] kill any process holding port 3000..." -ForegroundColor Cyan
$conns = Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue
if ($conns) {
    $pidList = $conns | Select-Object -ExpandProperty OwningProcess -Unique
    foreach ($id in $pidList) {
        try {
            $proc = Get-Process -Id $id -ErrorAction Stop
            Write-Host "  - kill PID $($proc.Id) ($($proc.ProcessName))"
            Stop-Process -Id $proc.Id -Force
        } catch { }
    }
} else {
    Write-Host "  port 3000 is free"
}

Write-Host ""
Write-Host "[ready] run 'npm run dev' to start dev mode." -ForegroundColor Green
Write-Host "[ready] when done, run: powershell -File C:\GTVS\dashboard\web\scripts\switch-to-prod.ps1" -ForegroundColor Green
