# Windows Defender 방화벽에 GTVS Dashboard 3000 인바운드 규칙 등록 (관리자 권한 필요)
param()

$RuleName = 'GTVS Dashboard 3000'

# 기존 규칙(잘못 만들어진 것 포함) 있으면 모두 제거 후 재등록
$existing = Get-NetFirewallRule -DisplayName $RuleName -ErrorAction SilentlyContinue
if ($existing) {
    Write-Host "[info] removing existing rule(s) before re-create" -ForegroundColor Yellow
    Remove-NetFirewallRule -DisplayName $RuleName
}

New-NetFirewallRule -DisplayName $RuleName -Direction Inbound -Action Allow -Protocol TCP -LocalPort 3000 -Profile Domain,Private | Out-Null

Write-Host "[ok] firewall rule '$RuleName' created (TCP 3000, Domain+Private only)" -ForegroundColor Green
Get-NetFirewallRule -DisplayName $RuleName | Select-Object DisplayName, Enabled, Direction, Action, Profile
