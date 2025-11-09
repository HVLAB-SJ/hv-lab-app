# Railway 데이터베이스 안전 관리 가이드

## 문제 원인 분석
Railway 배포 시 데이터베이스가 초기화된 이유:
1. Railway는 `/app/data` 경로에 volume을 마운트함
2. 환경 변수 `DATABASE_PATH=/app/data/database.db` 설정 필요
3. 새로 배포 시 코드가 실행되면서 빈 데이터베이스를 생성하여 기존 데이터 덮어씀

## 안전한 데이터베이스 업데이트 방법

### 방법 1: Railway Run 명령 사용 (권장)
Railway에 재배포하지 않고 직접 데이터베이스만 업데이트:

```bash
# 1. Railway 프로젝트에 연결
railway link

# 2. 업데이트 스크립트 실행
railway run node update-construction-payment.js
```

### 방법 2: 로컬 데이터베이스 백업 후 Railway에 업로드

```bash
# 1. 로컬 데이터베이스 백업
cp database.db database-backup-$(date +%Y%m%d).db

# 2. Railway 볼륨에 업로드
railway volume upload database.db /app/data/database.db
```

### 방법 3: Railway 환경에서 직접 SQL 실행

```bash
# Railway 환경에서 직접 명령 실행
railway run node -e "
const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database(process.env.DATABASE_PATH);
// SQL 명령 실행
db.close();
"
```

## 배포 전 체크리스트

### 재배포 전 반드시 확인:
1. ✅ Railway 데이터베이스 백업
   ```bash
   railway run node -e "const fs=require('fs'); fs.copyFileSync(process.env.DATABASE_PATH, '/app/data/backup-' + Date.now() + '.db')"
   ```

2. ✅ 환경 변수 확인
   ```bash
   railway variables
   ```
   필수 변수:
   - `DATABASE_PATH=/app/data/database.db`
   - `NODE_ENV=production`

3. ✅ Volume 마운트 확인
   - railway.toml에 volume 설정 확인
   - `/app/data` 경로에 마운트되어 있는지 확인

## 데이터베이스 복구 방법

만약 데이터가 손실된 경우:

1. **Railway 롤백 사용**
   ```bash
   # Railway 대시보드에서 이전 배포로 롤백
   # 또는 CLI 사용
   railway rollback
   ```

2. **로컬 백업에서 복구**
   ```bash
   # 백업 파일이 있다면
   railway volume upload database-backup.db /app/data/database.db
   ```

3. **update-construction-payment.js 스크립트 사용**
   ```bash
   railway run node update-construction-payment.js
   ```

## 주의사항

### ⚠️ 절대 하지 말아야 할 것:
- `npm start` 또는 `node server.js`를 Railway에서 직접 실행 (initDatabase가 데이터 덮어씀)
- 환경 변수 설정 없이 배포
- 백업 없이 재배포

### ✅ 항상 해야 할 것:
- 배포 전 데이터베이스 백업
- 환경 변수 확인
- 작은 변경사항은 railway run으로 직접 수정

## 공사대금 데이터 복구

"올바른 필라테스_신창재님" 공사대금 복구:

```bash
# Railway에서 실행
railway run node update-construction-payment.js
```

스크립트가 자동으로:
1. 올바른 필라테스 프로젝트 찾기
2. 기존 결제 레코드 확인
3. 없으면 생성, 있으면 업데이트
4. 금액: 8,000,000원
5. 결제 내역:
   - 계약금: 3,000,000원 (2024-01-15)
   - 중도금: 2,500,000원 (2024-02-01)
   - 잔금: 2,500,000원 (2024-02-28)

## 문제 발생 시 연락처
- Railway 지원: https://railway.app/support
- 프로젝트 관리자에게 연락

## 추가 보안 조치 권장사항

1. **데이터베이스 자동 백업 설정**
   - cron job으로 정기 백업
   - S3나 다른 저장소에 백업 저장

2. **배포 파이프라인 개선**
   - GitHub Actions에서 백업 자동화
   - 배포 전 데이터 검증

3. **읽기 전용 복제본 유지**
   - 실시간 복제본 유지
   - 문제 시 즉시 전환 가능