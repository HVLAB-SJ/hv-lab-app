# 긴급 전화/SMS 알림 설정 가이드

## 개요
긴급(urgent) 또는 매우긴급(emergency) 결제 요청 시 자동으로 SMS 및 음성 전화 알림이 발송됩니다.

## 알림 동작 방식
- **긴급(urgent)**: SMS 문자 발송
- **매우긴급(emergency)**: SMS 문자 + 음성 전화 발송

## CoolSMS 가입 및 설정

### 1. CoolSMS 회원가입
1. https://www.coolsms.co.kr 접속
2. 회원가입 후 로그인
3. 본인인증 완료

### 2. API 키 발급
1. 대시보드 → 개발자센터 → API Key 관리
2. **API Key 생성** 클릭
3. `API Key`와 `API Secret` 복사

### 3. 발신번호 등록
1. 대시보드 → 발신번호 관리
2. **발신번호 등록** 클릭
3. 본인 휴대폰 번호 등록 및 인증
4. 등록 완료 (예: 01012345678)

### 4. 충전
1. 대시보드 → 충전하기
2. SMS: 건당 약 15원
3. 음성 통화: 건당 약 30원
4. 필요한 만큼 충전 (최소 10,000원 권장)

## 환경 변수 설정

### Railway (프로덕션 환경)
1. Railway 대시보드 → Backend 서비스 선택
2. **Variables** 탭 클릭
3. 다음 환경 변수 추가:

```env
COOLSMS_API_KEY=발급받은_API_Key
COOLSMS_API_SECRET=발급받은_API_Secret
COOLSMS_FROM_NUMBER=01012345678
NOTIFICATION_PHONE_NUMBER=01087654321
```

- `COOLSMS_FROM_NUMBER`: CoolSMS에 등록한 발신번호
- `NOTIFICATION_PHONE_NUMBER`: 알림을 받을 관리자 전화번호

### 로컬 개발 환경
`backend/.env` 파일에 추가:

```env
COOLSMS_API_KEY=발급받은_API_Key
COOLSMS_API_SECRET=발급받은_API_Secret
COOLSMS_FROM_NUMBER=01012345678
NOTIFICATION_PHONE_NUMBER=01087654321
```

## 테스트 방법

### 1. 긴급 결제 요청 테스트 (SMS만)
1. 애플리케이션에서 결제 요청 생성
2. 긴급도를 **"긴급"**으로 설정
3. 요청 제출
4. 설정한 전화번호로 SMS 수신 확인

### 2. 매우긴급 결제 요청 테스트 (SMS + 음성)
1. 애플리케이션에서 결제 요청 생성
2. 긴급도를 **"매우긴급"**으로 설정
3. 요청 제출
4. SMS 수신 확인
5. 약 10-30초 후 음성 전화 수신 확인

## 문제 해결

### SMS/전화가 오지 않을 때
1. **환경 변수 확인**
   - Railway 대시보드에서 환경 변수가 정확히 설정되었는지 확인
   - 재배포 필요 (환경 변수 추가 후)

2. **CoolSMS 잔액 확인**
   - CoolSMS 대시보드에서 잔액 확인
   - 잔액 부족 시 충전

3. **발신번호 확인**
   - CoolSMS에 발신번호가 정상 등록되어 있는지 확인
   - 승인 대기 중이면 사용 불가

4. **로그 확인**
   ```bash
   # Railway 대시보드 → Backend 서비스 → Logs 탭
   # "✅ SMS 발송 성공" 또는 "❌ SMS 발송 실패" 메시지 확인
   ```

### 환경 변수가 없을 때
- 환경 변수가 설정되지 않으면 자동으로 건너뛰며, 에러가 발생하지 않습니다.
- 콘솔에 경고 메시지만 출력: "CoolSMS 환경 변수가 설정되지 않았습니다."

## 비용 절감 팁
1. **긴급도 적절히 사용**: 정말 긴급한 경우에만 "긴급" 또는 "매우긴급" 사용
2. **매우긴급은 신중히**: 음성 통화는 SMS보다 비용이 높음
3. **발신번호 관리**: 080 번호는 비용이 더 높으니 일반 휴대폰 번호 사용 권장

## API 참고 문서
- CoolSMS 개발자 문서: https://developers.coolsms.co.kr/
- Node.js SDK: https://github.com/coolsms/coolsms-sdk-js
