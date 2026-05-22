# Cloudflare Tunnel 동작 점검 - cloudflared Windows 서비스 상태, 최근 로그, 도달성
param(
    [string]$Hostname = ''
)

Write-Host "[1/3] cloudflared Windows service..." -ForegroundColor Cyan
$svc = Get-Service -Name 'cloudflared' -ErrorAction SilentlyContinue
if ($svc) {
    Write-Host "  Status: $($svc.Status)" -ForegroundColor Green
    Write-Host "  StartType: $($svc.StartType)"
} else {
    Write-Host "  service 'cloudflared' NOT installed. Run the install command from Zero Trust dashboard first." -ForegroundColor Red
    exit 1
}

Write-Host "[2/3] recent cloudflared log..." -ForegroundColor Cyan
$logCandidates = @(
    "$env:PROGRAMDATA\Cloudflare\Cloudflared\cloudflared.log",
    "$env:USERPROFILE\.cloudflared\cloudflared.log",
    "$env:PROGRAMFILES\cloudflared\cloudflared.log"
)
$logPath = $null
foreach ($p in $logCandidates) {
    if (Test-Path $p) { $logPath = $p; break }
}
if ($logPath) {
    Write-Host "  log: $logPath"
    Get-Content $logPath -Tail 15
} else {
    Write-Host "  no cloudflared.log found in standard locations." -ForegroundColor Yellow
    Write-Host "  Try Event Viewer or 'cloudflared.exe tail' command."
}

Write-Host "[3/3] reachability test..." -ForegroundColor Cyan
if ($Hostname -eq '') {
    Write-Host "  -Hostname not given. example:" -ForegroundColor Yellow
    Write-Host "    powershell -File C:\GTVS\dashboard\web\scripts\check-tunnel.ps1 -Hostname gtvs.example.com"
} else {
    $url = "https://$Hostname"
    Write-Host "  GET $url ..."
    try {
        $resp = Invoke-WebRequest -Uri $url -Method Head -MaximumRedirection 0 -UseBasicParsing -TimeoutSec 10 -ErrorAction Stop
        Write-Host "  HTTP $($resp.StatusCode) - reachable" -ForegroundColor Green
    } catch {
        $err = $_.Exception.Message
        if ($err -like '*302*' -or $err -like '*301*' -or $err -like '*Found*') {
            Write-Host "  HTTP redirect - reachable (Access or NextAuth login redirect)" -ForegroundColor Green
        } else {
            Write-Host "  failed: $err" -ForegroundColor Red
        }
    }
}
