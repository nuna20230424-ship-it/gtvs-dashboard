# 노트북 운영 자동화 가이드 (Phase 5)

Next.js 대시보드 자동 기동 + 일 1회 DB 백업 + 로그 점검.
본 문서의 모든 명령은 **본인 Windows 노트북의 PowerShell** 에서 실행한다 (관리자 권한 불필요).

## 1단계. Next.js 자동 기동

노트북 부팅/로그온 시 `http://localhost:3000` 이 자동으로 떠 있게 한다. 두 가지 방법 중 하나를 선택.

### 방법 A. 작업 스케줄러 + Hidden PowerShell (단순, 추가 도구 0)

가장 가벼운 옵션. 백그라운드로 떠 있고 콘솔 창은 안 보임.

#### A-1. 실행 스크립트 작성

`C:\GTVS\dashboard\scripts\start-dashboard.ps1` 신규.

```powershell
# Next.js production 서버 기동 + 로그 파일로 redirect
$ErrorActionPreference = "SilentlyContinue"
$logDir = "C:\GTVS\dashboard\logs"
New-Item -ItemType Directory -Force -Path $logDir | Out-Null
$logFile = Join-Path $logDir "dashboard-$(Get-Date -Format yyyyMMdd).log"
Set-Location "C:\GTVS\dashboard\web"
& npm run start *>> $logFile
```

> production 모드라 `next build` 산출물이 있어야 함. 처음 1회 `cd web && npm run build` 실행.

#### A-2. 작업 스케줄러 등록

```powershell
$action = New-ScheduledTaskAction `
    -Execute "powershell.exe" `
    -Argument "-WindowStyle Hidden -ExecutionPolicy Bypass -File C:\GTVS\dashboard\scripts\start-dashboard.ps1"

$trigger = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME

$settings = New-ScheduledTaskSettingsSet `
    -StartWhenAvailable `
    -DontStopOnIdleEnd `
    -RestartCount 3 `
    -RestartInterval (New-TimeSpan -Minutes 1)

Register-ScheduledTask `
    -TaskName "GTVS Dashboard" `
    -Action $action `
    -Trigger $trigger `
    -Settings $settings `
    -RunLevel Limited
```

#### A-3. 즉시 실행 + 검증

```powershell
Start-ScheduledTask -TaskName "GTVS Dashboard"
Start-Sleep -Seconds 5
Invoke-WebRequest -Uri http://localhost:3000 -UseBasicParsing | Select-Object StatusCode
# 200 또는 307(로그인 리다이렉트) 이 나오면 성공
```

### 방법 B. pm2 (자동 재시작 기능)

Next.js 가 에러로 죽었을 때 자동 재시작하는 robust 한 옵션. Node 추가 설치 1회 필요.

```powershell
npm install -g pm2 pm2-windows-startup
pm2-startup install
cd C:\GTVS\dashboard\web
pm2 start npm --name "gtvs-dashboard" -- run start
pm2 save
```

이후 노트북 재부팅 후 자동 기동 확인.

```powershell
pm2 list
pm2 logs gtvs-dashboard --lines 50
```

방법 A 와 B 중 **A 권장** (추가 도구 0, 단순). 죽지 않을 만큼 안정적이면 충분.

---

## 2단계. 일일 DB 백업

`scripts/backup.py` 가 이미 작성되어 있음. 매일 새벽 3시 실행되도록 등록.

### 2-1. Google Drive 폴더 경로 확인

```powershell
# 일반적으로 다음 둘 중 하나
Test-Path "$env:USERPROFILE\Google 드라이브\내 드라이브"
Test-Path "G:\내 드라이브"
```

존재하는 경로 아래에 `gtvs-backups` 하위 폴더가 자동 생성됨. 직접 미리 만들어 두지 않아도 됨.

만약 default 경로가 본인 환경과 다르면 작업 스케줄러 등록 시 환경변수로 override 가능.

### 2-2. 백업 스크립트 1회 수동 검증

```powershell
python C:\GTVS\dashboard\scripts\backup.py
```

기대 출력 예시.

```
[backup] OK: C:\Users\k251110\Google 드라이브\내 드라이브\gtvs-backups\gtvs-20260520.db (0.21 MB)
```

이 파일이 실제로 Google Drive 동기화 폴더에 들어갔는지 확인. 잠시 후 Google Drive 웹에서도 보여야 함.

경로 변경이 필요하면.

```powershell
$env:GTVS_BACKUP_DIR = "G:\내 드라이브\gtvs-backups"
python C:\GTVS\dashboard\scripts\backup.py
```

### 2-3. 작업 스케줄러 등록 (매일 새벽 3시)

```powershell
$action = New-ScheduledTaskAction `
    -Execute "python.exe" `
    -Argument "C:\GTVS\dashboard\scripts\backup.py"

$trigger = New-ScheduledTaskTrigger -Daily -At 3am

$settings = New-ScheduledTaskSettingsSet `
    -StartWhenAvailable `
    -WakeToRun

Register-ScheduledTask `
    -TaskName "GTVS Backup" `
    -Action $action `
    -Trigger $trigger `
    -Settings $settings `
    -RunLevel Limited
```

> 백업 경로를 default 이외로 쓰려면 작업의 **Action → Environment** 에서 `GTVS_BACKUP_DIR` 변수 추가, 또는 위 명령에 `-Argument` 를 `-Command "python -c '$env:GTVS_BACKUP_DIR=...; exec(...)'"` 식으로 작성. 가장 단순한 방법은 `backup.py` 상단 default 값을 본인 경로로 직접 수정.

### 2-4. 검증

```powershell
Start-ScheduledTask -TaskName "GTVS Backup"
Start-Sleep -Seconds 3
Get-ScheduledTaskInfo -TaskName "GTVS Backup" | Select-Object LastRunTime, LastTaskResult
# LastTaskResult: 0 이면 성공
```

---

## 3단계. 로그 점검

### Next.js 로그 (방법 A 의 경우)

```
C:\GTVS\dashboard\logs\dashboard-YYYYMMDD.log
```

매일 새 파일로 분리. 오류 발생 시 가장 먼저 확인.

### pm2 로그 (방법 B 의 경우)

```powershell
pm2 logs gtvs-dashboard
```

### gtvs_updater sink 로그

`gtvs_updater` 가 별도로 자체 로그를 남기는지 본인 환경 확인. sink 에러는 stderr 로 `[sqlite_sink] ...` 로 출력됨.

### 백업 작업 결과

```powershell
Get-ScheduledTaskInfo -TaskName "GTVS Backup" | Select-Object LastRunTime, LastTaskResult, NextRunTime
```

`LastTaskResult` 가 `0` 이외 값이면 에러. 백업 폴더에서 최근 파일을 확인하면 무엇이 잘못됐는지 추정 가능.

---

## 4단계. 평상시 운영 체크 (월 1회 정도)

```powershell
# 1. 대시보드 응답 확인
Invoke-WebRequest -Uri http://localhost:3000 -UseBasicParsing | Select-Object StatusCode

# 2. 백업 파일 갯수와 최신 파일 시각
Get-ChildItem "$env:USERPROFILE\Google 드라이브\내 드라이브\gtvs-backups" -Filter "gtvs-*.db" |
    Sort-Object LastWriteTime -Descending |
    Select-Object Name, LastWriteTime, @{N="MB";E={[math]::Round($_.Length/1MB,2)}} |
    Select-Object -First 10

# 3. pending_upload.jsonl 누적분 확인 (있으면 sink 가 실패 중)
$queue = "C:\GTVS\dashboard\integration\pending_upload.jsonl"
if (Test-Path $queue) {
    Write-Host "WARNING: pending queue exists - $((Get-Item $queue).Length) bytes"
} else {
    Write-Host "OK: no pending queue"
}

# 4. DB 파일 크기
Get-Item C:\GTVS\dashboard\db\gtvs.db | Select-Object Length, LastWriteTime
```

---

## 트러블슈팅

| 증상 | 확인할 곳 |
|---|---|
| 부팅 후 `http://localhost:3000` 응답 없음 | 방법 A — 작업 스케줄러 `GTVS Dashboard` 의 `LastTaskResult`, `dashboard-*.log`. 방법 B — `pm2 list`, `pm2 logs` |
| 로그인 후 페이지에서 데이터 안 보임 | `web/.env.local` 의 `DB_PATH`, `integration/.env` 의 `GTVS_DB_PATH` 가 같은 파일 가리키는지. `npm run build` 가 최신 코드로 돌았는지 |
| Google Drive 에 백업 파일이 안 보임 | Google Drive 클라이언트 동기화 중인지. 폴더 경로 default 가 본인 환경과 일치하는지. `GTVS_BACKUP_DIR` 환경변수로 override 가능 |
| 백업 작업이 매일 빠지는 일이 있음 | `-WakeToRun` 옵션을 줬어도 절전 모드/노트북 닫음으로 깰 수 없을 수 있음. 노트북을 절전이 아닌 항상 켜진 상태로 둬야 보장됨 |
| `pending_upload.jsonl` 이 누적됨 | sink 가 INSERT 실패 반복 중. `[sqlite_sink]` stderr 로그 확인, `gtvs.db` 파일 자체에 문제 있는지 확인. 백업 1개 복원 후 `python dry_run.py --flush` 로 큐 비우기 |

---

## 완료 시점 체크

- [ ] `Start-ScheduledTask -TaskName "GTVS Dashboard"` → `Invoke-WebRequest http://localhost:3000` 200/307
- [ ] `Start-ScheduledTask -TaskName "GTVS Backup"` → Google Drive 폴더에 `gtvs-YYYYMMDD.db` 생성 확인
- [ ] `Get-ScheduledTaskInfo` 둘 다 `LastTaskResult: 0`
- [ ] Phase 6 (실 데이터 검증) 진행 가능
