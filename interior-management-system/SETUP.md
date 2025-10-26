# 설치 및 실행 가이드

## 빠른 시작

### 1. 사전 요구사항

다음 프로그램들이 설치되어 있어야 합니다:

- **Node.js** 18.0.0 이상
- **MongoDB** 6.0 이상
- **npm** 또는 **yarn**

### 2. MongoDB 설치 및 실행

#### Windows
1. [MongoDB 공식 사이트](https://www.mongodb.com/try/download/community)에서 다운로드
2. 설치 후 MongoDB 서비스 실행:
```bash
# MongoDB 서비스 시작
net start MongoDB
```

#### Mac (Homebrew)
```bash
brew tap mongodb/brew
brew install mongodb-community
brew services start mongodb-community
```

#### Linux
```bash
sudo apt-get install mongodb
sudo systemctl start mongodb
```

### 3. 프로젝트 설치

#### 백엔드 설정

```bash
# 백엔드 디렉토리로 이동
cd interior-management-system/backend

# 패키지 설치
npm install

# 환경 변수 설정
cp .env.example .env

# .env 파일 편집 (필요한 경우)
# nano .env 또는 메모장으로 편집
```

**환경 변수 설정 (.env)**
```env
PORT=5000
NODE_ENV=development
MONGODB_URI=mongodb://localhost:27017/interior_management
JWT_SECRET=your_super_secret_jwt_key_change_this
JWT_EXPIRE=7d
```

#### 프론트엔드 설정

```bash
# 프론트엔드 디렉토리로 이동
cd ../frontend

# 패키지 설치
npm install

# 환경 변수 설정
cp .env.example .env

# .env 파일 편집
# nano .env 또는 메모장으로 편집
```

**환경 변수 설정 (.env)**
```env
VITE_API_URL=http://localhost:5000/api
VITE_SOCKET_URL=http://localhost:5000
```

### 4. 실행

#### 개발 모드로 실행

**터미널 1 - 백엔드**
```bash
cd interior-management-system/backend
npm run dev
```

**터미널 2 - 프론트엔드**
```bash
cd interior-management-system/frontend
npm run dev
```

#### 실행 확인

- **백엔드**: http://localhost:5000
- **프론트엔드**: http://localhost:5173

### 5. 초기 데이터 (선택사항)

테스트용 관리자 계정을 생성하려면:

```bash
cd backend
npm run seed  # seed 스크립트가 있는 경우
```

또는 회원가입 페이지에서 직접 계정을 생성하세요.

## 프로덕션 빌드

### 백엔드 빌드
```bash
cd backend
npm run build
npm start
```

### 프론트엔드 빌드
```bash
cd frontend
npm run build
npm run preview  # 프로덕션 미리보기
```

## 문제 해결

### 포트 충돌
포트 5000 또는 5173이 이미 사용 중인 경우:

**백엔드 (.env)**
```env
PORT=3000  # 다른 포트로 변경
```

**프론트엔드 (vite.config.ts)**
```ts
server: {
  port: 3001  // 다른 포트로 변경
}
```

### MongoDB 연결 오류
1. MongoDB가 실행 중인지 확인
2. MONGODB_URI가 올바른지 확인
3. 방화벽 설정 확인

### CORS 오류
백엔드 .env 파일에서 CORS_ORIGIN 설정:
```env
CORS_ORIGIN=http://localhost:5173
```

## 주요 기능 테스트

### 1. 로그인
- URL: http://localhost:5173/login
- 테스트 계정: 직접 생성하거나 seed 데이터 사용

### 2. 대시보드
- 전체 프로젝트 현황 확인
- 오늘의 일정 확인
- 최근 결제 요청 확인

### 3. 일정 관리
- 드래그 앤 드롭으로 일정 이동
- 새 일정 추가
- 캘린더/간트차트 뷰 전환

### 4. 결제 요청
- 새 결제 요청 생성
- 영수증 사진 첨부
- 결제 승인/거절

## 배포

### Vercel (프론트엔드)
```bash
cd frontend
npm install -g vercel
vercel
```

### Railway/Heroku (백엔드)
1. 프로젝트를 GitHub에 푸시
2. Railway/Heroku에서 프로젝트 연결
3. 환경 변수 설정
4. 배포

## 추가 리소스

- [React 공식 문서](https://react.dev)
- [MongoDB 문서](https://docs.mongodb.com)
- [Socket.io 문서](https://socket.io/docs)
- [Tailwind CSS 문서](https://tailwindcss.com/docs)

## 지원

문제가 발생하면 이슈를 등록하거나 개발팀에 문의하세요.