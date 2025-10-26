# 백업 정보 - 2025년 10월 26일

## 현재 작동 상태 백업
- **백업 시간**: 2025-10-26 15:00 KST
- **Git 브랜치**: `backup-2025-10-26-working-state`
- **커밋 ID**: `1fdec4d`
- **상태**: ✅ 정상 작동 중

## 시스템 구성
### 백엔드 (Railway 배포)
- **서비스**: hv-lab-app
- **프로젝트**: HV_WORKS
- **환경**: production
- **URL**: https://hvlab.app
- **Root Directory**: 기본값 (비워둠)
- **상태**: Active

### 프론트엔드
- **위치**: `frontend-source/interior-management-system/frontend`
- **빌드 명령어**: `npm install && npm run build`
- **시작 명령어**: `npm start`
- **참고**: 현재 Railway에는 백엔드만 배포됨

### 데이터베이스
- **타입**: SQLite
- **파일**: `database.db`
- **협력업체 수**: 155개
- **상태**: ✅ 정상

## 주요 기능 상태
- ✅ 협력업체 목록: 정상
- ✅ 결제 요청: 정상
- ✅ 실행 내역: 정상
- ✅ 일정 관리: 정상
- ✅ 프로젝트 관리: 정상
- ✅ Socket.io 연결: 정상

## 복구 방법
만약 문제가 발생하면 다음 명령어로 복구:

```bash
# 백업 브랜치로 전환
git checkout backup-2025-10-26-working-state

# 메인 브랜치를 백업 상태로 리셋
git checkout main
git reset --hard backup-2025-10-26-working-state
git push --force

# Railway에서 Redeploy 클릭
```

## 중요 참고사항
1. Railway Root Directory는 비워두거나 기본값 사용
2. 프론트엔드와 백엔드를 같은 서비스에 배포하려 하면 충돌 발생
3. 현재는 백엔드만 Railway에 배포된 상태
4. 데이터베이스는 로컬 SQLite 파일 사용

## 최근 수정 내역
- 긴급 결제 요청 버튼 UI 개선
- 실행내역 중복 생성 문제 해결
- SMS 알림 메시지 형식 개선
- 결제요청 수정 기능 활성화
- 실행내역에서 결제요청 숨김 기능 추가