# Railway Volume 설정 가이드

## Volume을 사용하는 이유
Railway는 기본적으로 ephemeral storage를 사용합니다. 즉, 재배포할 때마다 파일이 초기화됩니다.
Volume을 사용하면 데이터베이스 파일을 영구 보존할 수 있습니다.

## Railway Volume 설정 방법

### 1. Railway 대시보드 접속
1. https://railway.app 로그인
2. **HV_WORKS** 프로젝트 선택
3. **hv-lab-app** 서비스 클릭

### 2. Volume 생성
1. 왼쪽 메뉴에서 **"Data"** 탭 클릭
2. **"New Volume"** 버튼 클릭
3. Volume 설정:
   - **Name**: `database-volume` (원하는 이름)
   - **Mount Path**: `/app/data`
   - 크기는 기본값 사용 (1GB면 충분)
4. **"Create"** 버튼 클릭

### 3. 환경 변수 설정
1. **"Variables"** 탭으로 이동
2. 다음 환경 변수 추가:
   ```
   DATABASE_PATH=/app/data/database.db
   ```
3. **"Add"** 또는 **"Save"** 버튼 클릭

### 4. 서비스 재배포
Volume 생성 후 자동으로 재배포됩니다.

재배포 후 로그에서 다음 메시지를 확인:
```
✅ Created database directory: /app/data
SQLite 데이터베이스 연결 성공
데이터베이스 테이블 초기화 완료
협력업체 시드 데이터 삽입 시작...
협력업체 155/155개 생성 완료
```

### 5. 데이터 영구 보존 확인
- 재배포 후에도 데이터가 유지됩니다
- 로그에 "데이터베이스에 이미 155개의 협력업체가 있습니다." 메시지가 표시됩니다

## 현재 상태 (임시 방법)
현재는 시드 데이터를 코드에 포함시켜서, 재배포마다 협력업체 데이터를 자동으로 재생성합니다.
하지만 **사용자가 추가/수정한 데이터는 재배포 시 사라집니다**.

## Volume 설정 후 이점
✅ 재배포해도 데이터 유지
✅ 사용자가 추가/수정한 협력업체 데이터 보존
✅ 프로젝트, 일정, 결제 요청 등 모든 데이터 영구 보존
✅ 더 이상 시드 데이터 재삽입 불필요

## 주의사항
- Volume은 서비스당 하나만 생성 가능
- Volume 삭제 시 데이터도 함께 삭제됨 (백업 필요)
- Mount Path는 반드시 `/app/data`로 설정 (코드에서 이 경로를 사용)

## 데이터 백업 방법
Railway 대시보드에서:
1. **"Data"** 탭의 Volume 클릭
2. 파일 탐색기에서 `database.db` 다운로드
3. 로컬에 백업 저장

또는 API를 통해:
```bash
# Railway CLI 사용 (설치 필요)
railway run -- cp /app/data/database.db ./backup-$(date +%Y%m%d).db
```
