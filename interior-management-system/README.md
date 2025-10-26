# 인테리어 회사 통합 업무 관리 시스템

미니멀하고 직관적인 UI로 설계된 인테리어 회사 전용 업무 관리 시스템입니다.

## 최근 업데이트 (2025.10.26)
- 결제요청 수정 기능 활성화
- 실행내역 중복 생성 문제 해결
- SMS 알림 메시지 형식 개선
- 실행내역 삭제 로직 개선
- 실행내역에서 결제요청 숨김 기능 추가
- Railway 자동 배포 설정 완료 (HV_WORKS)

## 주요 기능

### 1. 공사 일정 관리 (우선순위: 높음)
- ✅ 다중 현장 동시 관리
- ✅ 드래그 앤 드롭 일정 변경
- ✅ 간트 차트 뷰 / 캘린더 뷰 전환
- ✅ 현장별 색상 코딩 (저채도)
- ✅ 공정 단계별 진행률 표시
- ✅ 담당자 배정 및 실시간 동기화

### 2. 결제 요청 시스템 (우선순위: 높음)
- ✅ 현장 소장이 모바일에서 즉시 요청
- ✅ 필수 입력: 금액, 계좌번호, 용도, 현장명
- ✅ 사진 첨부 기능 (영수증, 견적서)
- ✅ 상태 관리: 요청 → 검토중 → 승인 → 송금완료
- ✅ 결제 내역 대시보드 (월별/현장별 집계)
- ✅ 카카오톡 실시간 알림 (결제 요청시, 승인시)

### 3. 추가 기능
- ✅ 프로젝트 관리 (진행 상태, 예산 추적)
- ✅ 실시간 알림 시스템 (Socket.io)
- ✅ 대시보드 (통계 및 현황)
- ✅ 반응형 디자인 (모바일 우선)
- ✅ PWA 지원 (오프라인 작동)

## 기술 스택

### Frontend
- **Framework**: React 19 + TypeScript
- **Build Tool**: Vite
- **Styling**: Tailwind CSS
- **State Management**: Zustand + React Query
- **Form Management**: React Hook Form
- **Routing**: React Router v7
- **Calendar**: React Big Calendar
- **Drag & Drop**: React DnD
- **Icons**: Lucide React
- **PWA**: Vite PWA Plugin

### Backend
- **Runtime**: Node.js + Express
- **Language**: TypeScript
- **Database**: MongoDB (Mongoose)
- **Real-time**: Socket.io
- **Authentication**: JWT
- **File Upload**: Multer
- **Validation**: Express Validator

## 디자인 시스템

### 색상 팔레트
```
Primary: #6B7280 (차분한 그레이)
Black: #000000
White: #FFFFFF
Gray-50: #F5F5F5
Gray-100-900: 다양한 그레이 톤
```

### 폰트
- Inter / Pretendard

### 디자인 원칙
- 미니멀 디자인 (불필요한 요소 제거)
- 넉넉한 여백 (padding: 20px 이상)
- 그림자 사용 안함 (border만 사용)
- 최소한의 애니메이션 (0.2s ease)

## 설치 및 실행

### 사전 요구사항
- Node.js 18 이상
- MongoDB 6.0 이상
- npm 또는 yarn

### 백엔드 설정

```bash
# 백엔드 디렉토리로 이동
cd interior-management-system/backend

# 패키지 설치
npm install

# 환경 변수 설정
cp .env.example .env
# .env 파일을 열어 필요한 값들을 설정하세요

# 개발 서버 실행
npm run dev
```

### 프론트엔드 설정

```bash
# 프론트엔드 디렉토리로 이동
cd interior-management-system/frontend

# 패키지 설치
npm install

# 환경 변수 설정
cp .env.example .env
# .env 파일을 열어 API URL을 설정하세요

# 개발 서버 실행
npm run dev
```

## 프로젝트 구조

```
interior-management-system/
├── backend/
│   ├── src/
│   │   ├── config/         # 설정 파일
│   │   ├── models/         # 데이터베이스 모델
│   │   ├── controllers/    # API 컨트롤러
│   │   ├── routes/         # API 라우트
│   │   ├── middleware/     # 미들웨어
│   │   ├── services/       # 비즈니스 로직
│   │   ├── utils/          # 유틸리티 함수
│   │   └── index.ts        # 서버 진입점
│   ├── package.json
│   └── tsconfig.json
│
├── frontend/
│   ├── src/
│   │   ├── components/     # 재사용 가능한 컴포넌트
│   │   ├── pages/          # 페이지 컴포넌트
│   │   ├── contexts/       # React Context
│   │   ├── hooks/          # 커스텀 훅
│   │   ├── services/       # API 및 서비스
│   │   ├── store/          # 상태 관리
│   │   ├── utils/          # 유틸리티 함수
│   │   ├── types/          # TypeScript 타입
│   │   ├── App.tsx         # 앱 루트
│   │   └── main.tsx        # 앱 진입점
│   ├── package.json
│   ├── tailwind.config.js
│   ├── vite.config.ts
│   └── index.html
│
└── README.md
```

## API 엔드포인트

### 인증
- `POST /api/auth/register` - 사용자 등록
- `POST /api/auth/login` - 로그인
- `POST /api/auth/logout` - 로그아웃

### 프로젝트
- `GET /api/projects` - 프로젝트 목록 조회
- `POST /api/projects` - 프로젝트 생성
- `GET /api/projects/:id` - 프로젝트 상세 조회
- `PUT /api/projects/:id` - 프로젝트 수정
- `DELETE /api/projects/:id` - 프로젝트 삭제

### 일정
- `GET /api/schedules` - 일정 목록 조회
- `POST /api/schedules` - 일정 생성
- `PUT /api/schedules/:id` - 일정 수정
- `DELETE /api/schedules/:id` - 일정 삭제

### 결제
- `GET /api/payments` - 결제 요청 목록 조회
- `POST /api/payments` - 결제 요청 생성
- `PUT /api/payments/:id/status` - 결제 상태 변경

## Socket.io 이벤트

### Client → Server
- `join:project` - 프로젝트 룸 참여
- `leave:project` - 프로젝트 룸 나가기
- `schedule:update` - 일정 업데이트
- `payment:request` - 결제 요청
- `payment:statusUpdate` - 결제 상태 업데이트
- `message:send` - 메시지 전송

### Server → Client
- `schedule:updated` - 일정 업데이트 알림
- `payment:new` - 새 결제 요청 알림
- `payment:statusChanged` - 결제 상태 변경 알림
- `payment:update` - 결제 업데이트 알림
- `message:receive` - 메시지 수신
- `notification:receive` - 일반 알림 수신
- `users:active` - 활성 사용자 목록

## PWA 기능

- ✅ 오프라인 작동 지원
- ✅ 홈 화면에 추가 가능
- ✅ 푸시 알림 (예정)
- ✅ 백그라운드 동기화 (예정)

## 모바일 최적화

- 반응형 브레이크포인트: 640px, 768px, 1024px
- 터치 제스처 지원 (스와이프, 핀치)
- 모바일 우선 설계 (Mobile First)

## 보안

- JWT 기반 인증
- Password 해싱 (bcrypt)
- CORS 설정
- Helmet.js 보안 헤더
- Input Validation

## 향후 개발 계획

- [ ] 자재 발주 일정 관리
- [ ] 협력업체 일정 통합
- [ ] 현장 사진 공유 게시판
- [ ] 일일 작업 보고서
- [ ] 안전 점검 체크리스트
- [ ] 카카오톡 알림 API 연동
- [ ] 이메일 알림 시스템
- [ ] 파일 관리 시스템
- [ ] 보고서 생성 기능

## 라이선스

MIT License

## 개발자

Interior Management System Team

---

**Note**: 이 프로젝트는 인테리어 회사의 업무 효율성을 높이기 위해 개발되었습니다.