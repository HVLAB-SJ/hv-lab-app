# Railway 영구 저장소 설정 가이드

## 문제점
Railway는 ephemeral (휘발성) 파일 시스템을 사용합니다. 서비스가 재배포될 때마다:
- ❌ SQLite 데이터베이스 파일이 삭제됩니다
- ❌ 모든 사용자 데이터가 사라집니다
- ❌ 로그인이 불가능해집니다

## 해결 방법: Railway Volume 사용

### 1단계: Railway 프로젝트 접속
1. https://railway.app 로그인
2. `hv-lab-app` 프로젝트 선택
3. 서비스 선택

### 2단계: Volume 생성
1. **Settings** 탭 클릭
2. 왼쪽 메뉴에서 **Volumes** 선택
3. **+ New Volume** 클릭
4. Volume 이름 입력: `database-volume`
5. Mount Path 입력: `/app/data`
6. **Create** 클릭

### 3단계: 환경 변수 설정
1. **Variables** 탭 클릭
2. **+ New Variable** 클릭
3. 변수 추가:
   ```
   Name: DATABASE_PATH
   Value: /app/data/database.db
   ```
4. **Add** 클릭

### 4단계: 서비스 재배포
1. **Deployments** 탭 클릭
2. 최신 배포 오른쪽 메뉴(...) 클릭
3. **Redeploy** 선택

### 5단계: 확인
서비스가 재배포되면:
- ✅ 데이터베이스가 `/app/data/database.db`에 생성됩니다
- ✅ 6명의 기본 사용자가 자동 생성됩니다
- ✅ 재배포해도 데이터가 유지됩니다

## 기본 사용자 계정

| 사용자명 | 비밀번호 | 이름   | 역할    | 부서   |
|---------|---------|--------|---------|--------|
| 상준    | 0109    | 김상준 | manager | 관리부 |
| 신애    | 0109    | 이신애 | manager | 관리부 |
| 재천    | 0109    | 정재천 | worker  | 시공부 |
| 민기    | 0109    | 김민기 | worker  | 시공부 |
| 재성    | 0109    | 박재성 | worker  | 시공부 |
| 재현    | 0109    | 박재현 | worker  | 시공부 |

## 로그 확인
배포 후 로그에서 다음 메시지 확인:
```
✅ Created database directory: /app/data
✅ SQLite 데이터베이스 연결 성공
✅ 사용자 상준 생성 완료
✅ 사용자 신애 생성 완료
...
✅ 데이터베이스에 6명의 사용자가 있습니다.
```

## 문제 해결

### Volume이 마운트되지 않음
- Railway UI에서 Volume Mount Path가 정확히 `/app/data`인지 확인
- 서비스를 완전히 재배포 (Redeploy)

### 여전히 사용자가 없음
- 환경 변수 `DATABASE_PATH`가 `/app/data/database.db`로 설정되어 있는지 확인
- 로그에서 "Created database directory" 메시지 확인
- Volume이 제대로 마운트되었는지 확인

### 대안: PostgreSQL 사용
SQLite 대신 Railway에서 제공하는 PostgreSQL을 사용할 수도 있습니다:
1. Railway 프로젝트에 PostgreSQL 플러그인 추가
2. 코드 수정: SQLite → PostgreSQL 클라이언트로 변경
3. 자동으로 영구 저장소 제공

## 참고 자료
- Railway Volumes: https://docs.railway.app/reference/volumes
- Railway Environment Variables: https://docs.railway.app/develop/variables
