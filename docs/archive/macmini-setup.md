# [폐기] Mac mini 서버 셋업 가이드 (Postgres + Tailscale)

> **이 문서는 폐기됨 (2026-05-19 저녁).**
> Tailscale 설치/외부 기기 의존이 보안 이슈로 판단되어 노트북 단독 운영(SQLite)으로 전환.
> 현재 운영 가이드는 `docs/laptop-setup.md` 참조. 결정 배경은 `context-notes.md` 2026-05-19(저녁) 섹션.
> 본 문서는 의사결정 흐름 추적용으로만 보존.

---

GTVS 대시보드를 사내 Mac mini M4 Pro에서 운영하기 위한 1단계 가이드.

> 본 문서 범위 — Docker, Tailscale, Postgres 기동 + SQL 적용 + 외부망 접속 확인까지.
> 다음 단계 (Next.js Supabase → API Route 전환, Python sink 전환)는 별도 문서.

## 대상 환경

| 항목 | 값 |
|---|---|
| 호스트 | `gaebalQApateuui-Macmini` |
| 사용자 | `dqa` (관리자 권한 있음) |
| 사양 | M4 Pro / 24GB RAM / 1TB SSD |
| 공존 서비스 | OBS, STB 네트워크 대시보드 |
| 사용 포트 | 5432 (Postgres), 3000 (Next.js) — 충돌 없음 확인됨 |

---

## 0단계. 작업 전 준비 (Mac mini)

Mac mini 본체에서 직접 또는 SSH로 접속해서 진행한다.

체크.

```bash
sw_vers              # macOS 버전 확인 (13 이상 권장)
uname -m             # arm64 이어야 정상 (M4 Pro)
whoami               # dqa 이어야 함
df -h /             # 빈 공간 50GB 이상 권장
```

---

## 1단계. Homebrew 설치/확인

Homebrew는 macOS용 패키지 관리자. Tailscale, psql 클라이언트 설치에 사용.

```bash
brew --version
```

설치되어 있으면 1단계 건너뛰고 2단계로.

없다면.

```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

설치 마지막에 안내되는 PATH 추가 스크립트 두 줄을 그대로 실행 (Apple Silicon은 `/opt/homebrew`).

```bash
echo 'eval "$(/opt/homebrew/bin/brew shellenv)"' >> ~/.zprofile
eval "$(/opt/homebrew/bin/brew shellenv)"
```

**검증.**

```bash
brew --version       # Homebrew 4.x.x 가 출력되면 성공
```

---

## 2단계. Docker Desktop 설치

Postgres를 Docker 컨테이너로 돌리기 위함. macOS 데스크톱 앱이 필요.

```bash
brew install --cask docker
```

설치 후 **Launchpad에서 Docker 앱을 한 번 실행**한다 (라이선스 동의 + 권한 부여 필요).

기본 설정으로 두되, 다음 두 가지만 확인.

1. Docker Desktop → Settings → Resources → Memory **4GB 이상** 배정 (24GB 중 4GB만으로 충분)
2. Docker Desktop → Settings → General → **"Start Docker Desktop when you sign in"** 체크 (Mac mini 재부팅 시 자동 기동)

**검증.**

```bash
docker --version            # Docker version 27.x 정도
docker run --rm hello-world # "Hello from Docker!" 메시지 확인
```

---

## 3단계. Tailscale 설치 + Mac mini 등록

외부망/재택에서 접속하기 위한 메시 VPN.

### 3-1. Tailscale 앱 설치

```bash
brew install --cask tailscale
```

Launchpad에서 **Tailscale 앱 실행** → 메뉴바 우상단 아이콘 클릭 → **Log in**.

브라우저가 열리면서 SSO 로그인 화면이 뜬다. Google 또는 GitHub 계정으로 로그인 (회사 메일 계정 권장 — 같은 tailnet에 노트북/폰을 묶기 편함).

처음 로그인이면 새 tailnet이 자동 생성된다.

### 3-2. Mac mini의 tailnet IP 확인

```bash
tailscale ip -4
```

출력 예시 — `100.64.1.5` 형태의 IP가 나옴. **이 IP를 기록**해 둔다. Windows PC에서 Mac mini에 접속할 때 이 IP를 쓴다.

### 3-3. 노트북/폰에도 Tailscale 설치 (외부 접속용)

- Windows 노트북 → https://tailscale.com/download/windows 에서 설치 → 동일 계정으로 로그인
- iPhone/Android → App Store/Play Store에서 "Tailscale" 검색 → 동일 계정 로그인

같은 계정으로 로그인하면 자동으로 같은 tailnet에 포함된다.

**검증.**

노트북에서.

```bash
ping 100.64.1.5      # Mac mini tailnet IP. 응답 오면 성공
```

(Windows라면 `ping`은 똑같이 동작)

---

## 4단계. Postgres 컨테이너 기동

### 4-1. 데이터 볼륨 디렉토리 생성

```bash
mkdir -p /Users/dqa/gtvs-pg-data
mkdir -p /Users/dqa/gtvs-backups
```

### 4-2. 강한 비밀번호 생성 + 기록

```bash
openssl rand -base64 24
```

출력된 값(예: `Xk2Pq8mN...`)을 **반드시 안전한 곳에 보관**. 분실 시 컨테이너 재생성 필요.

이 값을 `<DB_PASSWORD>`로 부른다.

### 4-3. 컨테이너 기동

아래 명령에서 `<DB_PASSWORD>` 자리에 위에서 만든 값을 넣어 실행.

```bash
docker run -d \
  --name gtvs-postgres \
  --restart unless-stopped \
  -p 5432:5432 \
  -e POSTGRES_DB=gtvs \
  -e POSTGRES_USER=gtvs_app \
  -e POSTGRES_PASSWORD='<DB_PASSWORD>' \
  -v /Users/dqa/gtvs-pg-data:/var/lib/postgresql/data \
  postgres:17
```

> `--restart unless-stopped` 덕분에 Docker Desktop이 켜져 있는 한 Mac mini 재부팅 후에도 자동 기동된다.

**검증.**

```bash
docker ps | grep gtvs-postgres    # Up 상태 확인
docker logs gtvs-postgres | tail -5
# 마지막 줄에 "database system is ready to accept connections" 가 보이면 성공
```

---

## 5단계. psql 클라이언트 설치 + 접속 확인

SQL 적용용 클라이언트.

```bash
brew install libpq
echo 'export PATH="/opt/homebrew/opt/libpq/bin:$PATH"' >> ~/.zprofile
source ~/.zprofile
```

**검증.**

```bash
psql --version       # psql (PostgreSQL) 17.x
psql "postgres://gtvs_app:<DB_PASSWORD>@127.0.0.1:5432/gtvs" -c "select version();"
# PostgreSQL 17.x on aarch64-... 출력되면 성공
```

---

## 6단계. SQL 마이그레이션 적용

대시보드 폴더가 Mac mini에는 없을 수 있다. SQL 파일 두 개를 **Windows에서 Mac mini로 복사**한다.

### 6-1. Windows에서 Mac mini로 SQL 복사

Windows PowerShell에서.

```powershell
scp C:\GTVS\dashboard\db\migrations\001_init.sql dqa@100.64.1.5:/Users/dqa/
scp C:\GTVS\dashboard\db\migrations\002_seed.sql dqa@100.64.1.5:/Users/dqa/
```

(Mac mini의 SSH가 꺼져 있으면 시스템 설정 → 일반 → 공유 → 원격 로그인을 켠다)

또는 USB/공유 폴더로 옮겨도 OK.

### 6-2. SQL 적용 (Mac mini에서)

```bash
psql "postgres://gtvs_app:<DB_PASSWORD>@127.0.0.1:5432/gtvs" -f /Users/dqa/001_init.sql
psql "postgres://gtvs_app:<DB_PASSWORD>@127.0.0.1:5432/gtvs" -f /Users/dqa/002_seed.sql
```

**검증.**

```bash
psql "postgres://gtvs_app:<DB_PASSWORD>@127.0.0.1:5432/gtvs" -c "\dt public.*"
# devices, packages, update_records, users, version_history 5개 테이블 보이면 성공

psql "postgres://gtvs_app:<DB_PASSWORD>@127.0.0.1:5432/gtvs" -c "select count(*) from devices; select count(*) from packages;"
# devices=2, packages=18 이면 시드 적재 성공
```

---

## 7단계. Windows에서 Tailscale 경유 접속 확인

가장 중요한 검증. **Windows PC에서 Mac mini Postgres에 정상 연결되는지** 확인.

Windows PowerShell에서.

```powershell
# psql이 Windows에 없다면 먼저 설치: scoop install postgresql 또는 PostgreSQL 공식 설치프로그램
psql "postgres://gtvs_app:<DB_PASSWORD>@100.64.1.5:5432/gtvs" -c "select count(*) from devices;"
```

`count=2` 가 나오면 **Mac mini 셋업 완료**. Windows에서 Tailscale 경유로 Postgres에 정상 접속됨.

연결 안 되면 다음 확인.

- Mac mini에서 `tailscale status` — 노트북이 같은 tailnet에 있는지
- Mac mini 방화벽 — 시스템 설정 → 네트워크 → 방화벽이 켜져 있으면 Tailscale 인터페이스(`utun*`)에서 들어오는 5432 허용 필요. 기본 설정에선 보통 OK
- Docker 포트 매핑 — `docker ps` 출력에 `0.0.0.0:5432->5432/tcp` 보여야 함

---

## 8단계. 자동 백업 설정 (선택, 권장)

`pg_dump`로 매일 1회 백업하는 launchd 작업.

`/Users/dqa/Library/LaunchAgents/com.gtvs.pgbackup.plist` 파일 생성.

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key><string>com.gtvs.pgbackup</string>
    <key>ProgramArguments</key>
    <array>
        <string>/bin/sh</string>
        <string>-c</string>
        <string>/opt/homebrew/opt/libpq/bin/pg_dump "postgres://gtvs_app:<DB_PASSWORD>@127.0.0.1:5432/gtvs" -Fc -f /Users/dqa/gtvs-backups/gtvs-$(date +\%Y\%m\%d).dump &amp;&amp; find /Users/dqa/gtvs-backups -name 'gtvs-*.dump' -mtime +30 -delete</string>
    </array>
    <key>StartCalendarInterval</key>
    <dict>
        <key>Hour</key><integer>3</integer>
        <key>Minute</key><integer>0</integer>
    </dict>
</dict>
</plist>
```

등록.

```bash
launchctl load ~/Library/LaunchAgents/com.gtvs.pgbackup.plist
```

매일 새벽 3시에 백업 파일이 `/Users/dqa/gtvs-backups/`에 쌓이며, 30일 이상 된 파일은 자동 삭제된다.

---

## 완료 시점 체크

- [ ] Docker Desktop이 자동 시작으로 설정됨
- [ ] `docker ps`에 `gtvs-postgres` Up 상태
- [ ] Mac mini의 tailnet IP 기록됨 (예: `100.64.1.5`)
- [ ] 노트북에서 `ping <tailnet IP>` 응답 OK
- [ ] Windows에서 `psql ... -c "select count(*) from devices"` → 2 출력
- [ ] DB 비밀번호 안전한 곳에 보관됨

위 6개 모두 체크되면 다음 단계(Next.js & Python 코드 전환)로 진행 가능.

---

## 다음 단계 (별도 문서 예정)

1. **`docs/migration-to-postgres.md`** — Next.js Supabase 의존 제거 + NextAuth 도입 + API Route 작성
2. **`docs/python-sink-rewrite.md`** — Python `supabase_sink.py` → `dashboard_sink.py` 재작성
3. **운영 자동화** — Tailscale ACL, Mac mini 무인 부팅, 모니터링
