# HV LAB App - Claude Code 자동화 지침

## 프론트엔드 수정 후 자동 배포 프로세스

### 자동 수행 조건
다음 파일들이 수정되었을 때 자동으로 배포 프로세스를 실행하세요:
- `interior-management-system/frontend/src/**/*.tsx`
- `interior-management-system/frontend/src/**/*.ts`
- `interior-management-system/frontend/src/**/*.css`

### 배포 프로세스
프론트엔드 파일이 수정되면 다음 단계를 자동으로 수행하세요:

1. **빌드 수행**
   ```bash
   cd interior-management-system/frontend
   npm run build
   ```

2. **빌드 결과물 복사**
   ```bash
   powershell -Command "Copy-Item -Path 'interior-management-system/frontend/dist/*' -Destination 'public/' -Recurse -Force"
   ```

3. **Firebase 배포**
   ```bash
   firebase deploy --only hosting
   ```

### 주의사항
- **Railway, GitHub 사용 금지** - 이 프로젝트는 Firebase만 사용
- git push 하지 말 것 (로컬 커밋만 필요시 수행)
- 빌드가 실패하면 다음 단계로 진행하지 마세요
- 각 단계의 성공 여부를 확인하고 사용자에게 알려주세요
- AdditionalWork.tsx 파일이 수정 중이면 배포를 대기하세요

### 빠른 실행 명령어
- **배치 파일**: `deploy.bat` 실행
- **npm 스크립트**: `npm run auto-deploy`
- **슬래시 명령**: `/deploy`

## 프로젝트 특별 지침

### 데이터베이스
- SQLite 사용 (database.db)
- 자동 백업이 매일 00:00에 실행됨

### API 엔드포인트
- 모든 API는 `/api/` 접두사 사용
- 인증이 필요한 엔드포인트는 JWT 토큰 필요

### 프론트엔드
- React + TypeScript + Vite
- Tailwind CSS 사용
- 빌드 후 항상 public 디렉토리로 복사 필요