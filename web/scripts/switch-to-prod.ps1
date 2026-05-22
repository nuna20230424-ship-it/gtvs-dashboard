# GTVS Dashboard - 자동시작 Task 를 켜고 production server 즉시 기동
# BUILD_ID 가 없으면 (dev 가 .next 를 invalidate 한 직후 등) 'npm run build' 를 먼저 실행
param()

$TaskName = 'GTVS Dashboard'
$ProjectDir = 'C:\GTVS\dashboard\web'
$BuildIdPath = Join-Path $ProjectDir '.next\BUILD_ID'
$LogPath = Join-Path $ProjectDir '.runlogs\server.log'

Write-Host "[1/4] kill any process holding port 3000..." -ForegroundColor Cyan
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

if (-not (Test-Path $BuildIdPath)) {
    Write-Host "[2/4] .next/BUILD_ID missing - running 'npm run build'..." -ForegroundColor Cyan
    Push-Location $ProjectDir
    & npm.cmd run build
    $code = $LASTEXITCODE
    Pop-Location
    if ($code -ne 0) {
        Write-Host "  build failed (exit $code). aborting." -ForegroundColor Red
        exit 1
    }
    if (-not (Test-Path $BuildIdPath)) {
        Write-Host "  build finished but BUILD_ID still missing. aborting." -ForegroundColor Red
        exit 1
    }
    Write-Host "  build ok" -ForegroundColor Green
} else {
    Write-Host "[2/4] .next/BUILD_ID present - skipping build" -ForegroundColor Cyan
}

Write-Host "[3/4] enable + start scheduled task..." -ForegroundColor Cyan
try { Enable-ScheduledTask -TaskName $TaskName -ErrorAction Stop | Out-Null } catch {
    Write-Host "  enable failed: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}
Start-ScheduledTask -TaskName $TaskName

Write-Host "[4/4] waiting 5s for server to bind..." -ForegroundColor Cyan
Start-Sleep -Seconds 5
$conn = Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue
if ($conn) {
    Write-Host "  OK - listening on port 3000 (PID $($conn[0].OwningProcess))" -ForegroundColor Green
    if (Test-Path $LogPath) {
        Write-Host "  recent log:" -ForegroundColor Gray
        Get-Content $LogPath -Tail 8
    }
} else {
    Write-Host "  not listening yet. recent log:" -ForegroundColor Yellow
    if (Test-Path $LogPath) { Get-Content $LogPath -Tail 20 }
}
