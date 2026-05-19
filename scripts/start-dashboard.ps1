# Next.js production 서버 자동 기동 스크립트 — 작업 스케줄러가 로그온 시 hidden 으로 실행
$ErrorActionPreference = "SilentlyContinue"

$logDir = "C:\GTVS\dashboard\logs"
New-Item -ItemType Directory -Force -Path $logDir | Out-Null
$logFile = Join-Path $logDir "dashboard-$(Get-Date -Format yyyyMMdd).log"

Set-Location "C:\GTVS\dashboard\web"
& npm run start *>> $logFile
