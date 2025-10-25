# Railway 환경변수 설정 가이드

## 필수 환경변수

Railway 대시보드에서 다음 환경변수를 설정해야 합니다:

### 1. SOLAPI 인증 정보
```
SOLAPI_API_KEY=NCSAOUKZWBK9ISKK
SOLAPI_API_SECRET=OUETIQGRMUWMWYYU4KKJMCROBLPMSNMB
```

### 2. SOLAPI 채널 정보
```
SOLAPI_PFID=KA01PF251010200623410stJ4ZpKzQLv
```

### 3. 알림톡 템플릿 ID (중요!)
```
SOLAPI_TEMPLATE_ID=KA01TP2510102016192182Rh5igl5PtG
```
✅ HV LAB 정산 채널의 템플릿 ID입니다
템플릿 변수: 프로젝트명, 금액, 예금주, 은행명, 계좌번호

### 4. 발신번호 (중요!)
```
SOLAPI_FROM_NUMBER=01012345678
```
⚠️ 실제 사용하는 발신번호로 변경하세요 (SOLAPI에 등록된 번호여야 함)

### 5. 관리자 전화번호 목록 (중요!)
```
ADMIN_PHONE_NUMBERS=01012345678,01098765432
```
⚠️ 알림톡을 받을 실제 관리자 번호들을 콤마로 구분하여 입력하세요

## 설정 확인 방법

1. Railway 대시보드 접속
2. HV LAB app 프로젝트 선택
3. Variables 탭 클릭
4. 위 환경변수들 추가/수정

## 테스트 방법

환경변수 설정 후:

1. 관리자로 로그인
2. 브라우저에서 다음 접속:
   - 설정 확인: https://hv-lab-app.up.railway.app/api/test/config
   - 테스트 발송: POST https://hv-lab-app.up.railway.app/api/test/alimtalk

## 로그 확인

```bash
railway logs
```

명령으로 SOLAPI 관련 디버그 로그를 확인할 수 있습니다.