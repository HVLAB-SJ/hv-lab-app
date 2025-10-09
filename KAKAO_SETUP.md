# 카카오톡 알림 설정 완벽 가이드

## 🚀 빠른 시작 (3단계)

### 1️⃣ 카카오톡 채널 만들기 (10분)
1. https://center-pf.kakao.com 접속
2. "채널 개설하기" → 회사명 입력
3. 완료!

### 2️⃣ 알림톡 신청 (2-3일 대기)
1. https://business.kakao.com 가입
2. 채널 연동 → 알림톡 신청
3. 템플릿 등록

### 3️⃣ 코드에 API 키 추가
`.env` 파일에 추가:
```
KAKAO_API_KEY=발급받은_API_키
KAKAO_SENDER_KEY=발신프로필_키
KAKAO_TEMPLATE_CODE=템플릿_코드
```

---

## 📋 상세 설정 방법

### A. 카카오 비즈니스 계정 설정

#### 필요한 것들:
- 사업자등록증
- 관리자 휴대폰
- 회사 이메일

#### 단계별 진행:

1. **카카오톡 채널 개설**
   ```
   URL: https://center-pf.kakao.com

   입력 정보:
   - 채널명: HV LAB 현장관리
   - 검색용 ID: hvlab_field
   - 카테고리: 비즈니스 > 건설/인테리어
   ```

2. **비즈니스 인증**
   ```
   필요 서류:
   - 사업자등록증 스캔본
   - 통신판매업신고증 (선택)

   승인 기간: 1-2일
   ```

3. **알림톡 서비스 신청**
   ```
   URL: https://business.kakao.com

   서비스 선택:
   - [X] 알림톡
   - [ ] 친구톡 (선택사항)
   - [ ] 상담톡 (선택사항)
   ```

### B. 템플릿 등록

#### 결제 요청 템플릿
```
템플릿 코드: PAY_REQ_001
템플릿명: 결제요청알림

[HV LAB 결제 요청]

#{요청자}님이 결제를 요청했습니다.

현장: #{현장명}
금액: #{금액}원
구분: #{구분}
내용: #{내용}

▼ 계좌정보
#{은행} #{계좌번호}
예금주: #{예금주}

관리시스템에서 확인하세요.
```

#### 결제 승인 템플릿
```
템플릿 코드: PAY_APP_001
템플릿명: 결제승인알림

[결제 승인 완료]

요청하신 결제가 승인되었습니다.

금액: #{금액}원
승인자: #{승인자}
승인시각: #{시각}

곧 입금 예정입니다.
```

#### 결제 완료 템플릿
```
템플릿 코드: PAY_COM_001
템플릿명: 결제완료알림

[결제 완료]

요청하신 금액이 입금되었습니다.

금액: #{금액}원
처리일: #{날짜}

확인 부탁드립니다.
```

### C. API 연동

#### 1. 환경변수 설정
`.env` 파일:
```env
# 카카오 알림톡 설정
KAKAO_API_KEY=12345678901234567890
KAKAO_SENDER_KEY=abcdefghijklmnop
KAKAO_ADMIN_PHONE=010-1234-5678,010-8765-4321

# 템플릿 코드
KAKAO_TEMPLATE_PAYMENT_REQUEST=PAY_REQ_001
KAKAO_TEMPLATE_PAYMENT_APPROVE=PAY_APP_001
KAKAO_TEMPLATE_PAYMENT_COMPLETE=PAY_COM_001
```

#### 2. 결제 라우트 수정
`server/routes/payments.js`:
```javascript
const kakao = require('../utils/kakao-notification');

// 결제 요청 생성 시 알림
router.post('/', authenticateToken, async (req, res) => {
    // ... 결제 요청 저장 로직 ...

    // 카카오톡 알림 발송
    if (process.env.KAKAO_API_KEY) {
        const adminPhones = process.env.KAKAO_ADMIN_PHONE.split(',');
        await kakao.notifyPaymentRequest({
            requester_name: req.user.name,
            project_name: project.name,
            amount: req.body.amount,
            description: req.body.description
        }, adminPhones);
    }
});
```

### D. 비용 안내

#### 알림톡 비용
- **발송 단가**: 건당 8원~12원
- **월 기본료**: 없음
- **대량 발송 할인**: 월 10만건 이상 시 할인

#### 예상 비용 (월 기준)
```
일일 평균 결제 요청: 20건
알림 대상: 관리자 3명
일일 발송량: 20 × 3 = 60건
월간 발송량: 60 × 22일 = 1,320건
월 예상 비용: 1,320 × 10원 = 13,200원
```

### E. 테스트 방법

#### 1. 개발 환경 테스트
```javascript
// test-kakao.js
const kakao = require('./server/utils/kakao-notification');

// 테스트 발송
kakao.sendAlimtalk('010-1234-5678', {
    requesterName: '김현장',
    projectName: '강남 오피스텔',
    amount: 500000,
    description: '타일 자재비'
}).then(result => {
    console.log('발송 결과:', result);
});
```

#### 2. 실제 테스트
1. 테스트용 템플릿 등록
2. 본인 번호로 발송 테스트
3. 로그 확인

### F. 문제 해결

#### 자주 발생하는 오류

1. **템플릿 검수 반려**
   - 원인: 광고성 문구 포함
   - 해결: 정보성 문구만 사용

2. **발송 실패**
   - 원인: 잘못된 전화번호 형식
   - 해결: 010-0000-0000 형식 확인

3. **API 인증 오류**
   - 원인: 잘못된 API 키
   - 해결: 비즈니스 콘솔에서 재확인

### G. 추가 기능

#### 1. 대량 발송
```javascript
// 여러 명에게 동시 발송
const recipients = [
    { phone: '010-1111-1111', name: '김과장' },
    { phone: '010-2222-2222', name: '이부장' },
    { phone: '010-3333-3333', name: '박대리' }
];

const results = await Promise.all(
    recipients.map(r => kakao.sendAlimtalk(r.phone, params))
);
```

#### 2. 예약 발송
```javascript
// 특정 시간에 발송
const scheduledTime = new Date();
scheduledTime.setHours(9, 0, 0); // 오전 9시

kakao.sendAlimtalkScheduled(phone, params, scheduledTime);
```

#### 3. 발송 이력 조회
```javascript
// 발송 결과 확인
const history = await kakao.getMessageHistory({
    startDate: '2024-01-01',
    endDate: '2024-01-31'
});
```

---

## 🆚 다른 알림 방법과 비교

| 구분 | 카카오톡 | 문자(SMS) | 이메일 | 앱 푸시 |
|------|----------|-----------|--------|---------|
| 도달률 | 98% | 95% | 60% | 70% |
| 비용 | 10원/건 | 20원/건 | 무료 | 무료 |
| 설정 난이도 | 중간 | 쉬움 | 쉬움 | 어려움 |
| 신뢰도 | 높음 | 높음 | 보통 | 보통 |
| 추천 상황 | 공식 알림 | 긴급 알림 | 보고서 | 일반 알림 |

---

## 📞 지원 및 문의

### 카카오 비즈니스 고객센터
- 전화: 1544-4293
- 운영시간: 평일 09:00~18:00
- 이메일: bizchat@kakaocorp.com

### 자주 묻는 질문
1. **Q: 개인 사업자도 가능한가요?**
   A: 네, 사업자등록증이 있으면 가능합니다.

2. **Q: 심사는 얼마나 걸리나요?**
   A: 채널 1-2일, 알림톡 2-3일 소요됩니다.

3. **Q: 무료로 테스트할 수 있나요?**
   A: 네, 월 1,000건까지 무료 테스트 가능합니다.

---

## ✅ 체크리스트

- [ ] 카카오톡 채널 개설
- [ ] 비즈니스 인증 완료
- [ ] 알림톡 서비스 신청
- [ ] 템플릿 3개 등록
- [ ] API 키 발급
- [ ] .env 파일 설정
- [ ] 테스트 발송 확인
- [ ] 관리자 번호 등록
- [ ] 실제 운영 시작