# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# 패키지 파일만 먼저 복사 (캐싱 최적화)
COPY package*.json ./

# 모든 의존성 설치 (빌드용)
RUN npm ci

# 소스 코드 복사 및 빌드
COPY . .
RUN npm run build

# Production stage
FROM node:20-alpine AS production

WORKDIR /app

# 패키지 파일 복사
COPY package*.json ./

# Production 의존성만 설치 (devDependencies 제외)
RUN npm ci --omit=dev && npm cache clean --force

# 빌드된 파일만 복사
COPY --from=builder /app/dist ./dist

# 환경 변수
ENV NODE_ENV=production
ENV PORT=5000

EXPOSE 5000

# 직접 node 실행 (npm start보다 빠름)
CMD ["node", "dist/index.js"]
