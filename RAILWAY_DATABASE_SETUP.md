# Railway Database Setup - 영구 저장소 설정

## 문제점
Railway는 기본적으로 ephemeral(임시) 파일 시스템을 사용합니다. 이는 배포할 때마다 파일 시스템이 초기화되어 SQLite 데이터베이스가 사라지는 문제를 발생시킵니다.

## 해결방법

### 1. Railway Volume (영구 저장소) 설정

Railway 웹사이트에서 다음 단계를 수행하세요:

1. Railway 프로젝트 대시보드로 이동
2. `hv-lab-app` 서비스 선택
3. `Settings` 탭으로 이동
4. `Volumes` 섹션으로 스크롤
5. `+ New Volume` 클릭
6. Volume 설정:
   - **Name**: `hvlab-database-volume`
   - **Mount Path**: `/app/data`
7. `Add Volume` 클릭

### 2. 환경 변수 설정

Railway 서비스 설정에서 다음 환경 변수를 추가하세요:

```
DATABASE_PATH=/app/data/database.db
```

1. `Variables` 탭으로 이동
2. `+ New Variable` 클릭
3. 변수 추가:
   - **Key**: `DATABASE_PATH`
   - **Value**: `/app/data/database.db`
4. `Add` 클릭

### 3. 데이터베이스 파일 업로드

로컬 데이터베이스를 Railway 볼륨에 업로드해야 합니다:

**옵션 A: Railway CLI 사용** (추천)
```bash
# Railway CLI로 볼륨에 데이터베이스 업로드
railway volume upload hvlab-database-volume database.db /app/data/database.db
```

**옵션 B: 서버 재배포 후 API로 데이터 수동 입력**
- Volume 설정 후 첫 배포 시 빈 데이터베이스가 생성됩니다
- 로그인: 기본 계정으로 로그인 가능 (username: 상준, password: 0109)
- 데이터를 수동으로 다시 입력해야 합니다

### 4. 배포

모든 설정이 완료되면 배포합니다:

```bash
npm run deploy
```

또는 수동으로:
```bash
git add .
git commit -m "Add persistent volume configuration for Railway"
git push
```

## 확인사항

배포 후 Railway 로그를 확인하세요:
```bash
railway logs
```

다음과 같은 로그가 표시되어야 합니다:
```
✅ Created database directory: /app/data
SQLite 데이터베이스 연결 성공
✅ 데이터베이스에 6명의 사용자가 있습니다.
```

## 파일 변경사항

- `railway.toml`: Railway 볼륨 설정 추가
- `.env`: DATABASE_PATH 환경 변수 설명 추가
- `server/config/database.js`: 이미 DATABASE_PATH 환경 변수 지원 중

## 백업 권장사항

정기적으로 데이터베이스를 백업하세요:

```bash
# Railway에서 데이터베이스 다운로드
railway volume download hvlab-database-volume /app/data/database.db ./database-backup.db
```

또는 로컬 서버를 실행하여 현재 `database.db`를 백업하세요.
