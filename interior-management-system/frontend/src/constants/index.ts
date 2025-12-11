/**
 * 앱 전체에서 사용되는 상수들
 */

// 팀원 목록
export const TEAM_MEMBERS = [
  '상준',
  '신애',
  '재천',
  '민기',
  '재성',
  '재현',
  '안팀'
] as const;

// 직책 포함 팀원 목록
export const TEAM_MEMBERS_WITH_POSITION = [
  '상준 대표',
  '신애 팀장',
  '재천 팀장',
  '민기 매니저',
  '재성 디자이너',
  '재현 디자이너'
] as const;

// 공정 목록 (전체)
export const PROCESS_LIST = [
  '현장점검',
  '가설',
  '철거',
  '방수',
  '단열',
  '설비',
  '전기배선',
  '인터넷선',
  '에어컨배관',
  '전열교환기',
  '소방',
  '창호',
  '현관문교체',
  '목공',
  '조명타공',
  '금속',
  '타일',
  '도장',
  '마루',
  '필름',
  '도배',
  '중문',
  '가구',
  '상판',
  '욕실집기',
  '조명',
  '이노솔',
  '유리',
  '실리콘',
  '도어락',
  '커튼/블라인드',
  '청소',
  '마감',
  '준공검사',
  '가전입고',
  '스타일링',
  '촬영',
  '이사',
  '기타'
] as const;

// 결제용 공정 목록 (간소화)
export const PAYMENT_PROCESS_LIST = [
  '가설',
  '철거',
  '설비/미장',
  '전기',
  '목공',
  '조명',
  '가구',
  '마루',
  '타일',
  '욕실',
  '필름',
  '도배',
  '도장',
  '창호',
  '에어컨',
  '기타'
] as const;

// 프로젝트 상태
export const PROJECT_STATUS = {
  CONTRACT: '계약',
  IN_PROGRESS: '진행중',
  ADJUSTMENT: '정산',
  AS: 'A/S',
  COMPLETED: '완료',
  HOLD: '보류'
} as const;

// 결제 방법
export const PAYMENT_METHODS = {
  BANK_TRANSFER: '계좌이체',
  CARD: '카드',
  CASH: '현금',
  OTHERS: '기타'
} as const;

// 은행 코드 매핑
export const BANK_CODE_MAP: Record<string, string> = {
  'KB국민은행': '004',
  '국민은행': '004',
  '신한은행': '088',
  '우리은행': '020',
  '하나은행': '081',
  'IBK기업은행': '003',
  '기업은행': '003',
  'NH농협은행': '011',
  '농협은행': '011',
  'SC제일은행': '023',
  '제일은행': '023',
  '한국씨티은행': '027',
  '씨티은행': '027',
  '새마을금고': '045',
  '신협': '048',
  '우체국': '071',
  'KDB산업은행': '002',
  '산업은행': '002',
  '수협은행': '007',
  '대구은행': '031',
  '부산은행': '032',
  '경남은행': '039',
  '광주은행': '034',
  '전북은행': '037',
  '제주은행': '035',
  '카카오뱅크': '090',
  '케이뱅크': '089',
  'K뱅크': '089',
  '토스뱅크': '092'
} as const;

// 토스뱅크용 은행명 매핑
export const TOSS_BANK_NAME_MAP: Record<string, string> = {
  'KB국민은행': 'KB국민',
  '국민은행': 'KB국민',
  'IBK기업은행': '기업',
  '기업은행': '기업',
  'NH농협은행': '농협',
  '농협은행': '농협',
  'SC제일은행': 'SC제일',
  '제일은행': 'SC제일',
  '한국씨티은행': '씨티',
  '씨티은행': '씨티',
  'KDB산업은행': '산업',
  '산업은행': '산업',
  '케이뱅크': 'K뱅크',
  // 나머지는 그대로 사용
} as const;

// 날짜 형식
export const DATE_FORMAT = {
  FULL: 'yyyy년 M월 d일 (EEEE)',
  SHORT: 'yyyy-MM-dd',
  MONTH_DAY: 'M/d',
  TIME: 'HH:mm',
  DATETIME: 'yyyy-MM-dd HH:mm'
} as const;

// 색상 테마
export const COLORS = {
  PRIMARY: '#3B82F6', // blue-500
  SUCCESS: '#10B981', // green-500
  WARNING: '#F59E0B', // amber-500
  ERROR: '#EF4444', // red-500
  INFO: '#6B7280', // gray-500
} as const;

// 파일 크기 제한
export const FILE_SIZE_LIMITS = {
  IMAGE_MAX_SIZE: 5 * 1024 * 1024, // 5MB
  DOCUMENT_MAX_SIZE: 10 * 1024 * 1024, // 10MB
  TOTAL_STORAGE_LIMIT: 50 * 1024 * 1024, // 50MB
} as const;

// 이미지 압축 설정
export const IMAGE_COMPRESSION = {
  MAX_WIDTH: 800,
  QUALITY: 0.7,
  THUMBNAIL_SIZE: 150,
} as const;

// 페이지네이션
export const PAGINATION = {
  DEFAULT_PAGE_SIZE: 20,
  PAGE_SIZE_OPTIONS: [10, 20, 50, 100],
} as const;

// API 설정
export const API_CONFIG = {
  TIMEOUT: 30000, // 30초
  RETRY_COUNT: 3,
  RETRY_DELAY: 1000, // 1초
} as const;

// 정규표현식 패턴
export const PATTERNS = {
  PHONE: /^01[0-9]-?[0-9]{3,4}-?[0-9]{4}$/,
  EMAIL: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  ACCOUNT_NUMBER: /^\d{10,20}$/,
  BUSINESS_NUMBER: /^\d{3}-\d{2}-\d{5}$/,
} as const;

// 로컬스토리지 키
export const STORAGE_KEYS = {
  AUTH_TOKEN: 'token',
  USER_INFO: 'userInfo',
  THEME: 'theme',
  RECENT_PROJECTS: 'recentProjects',
  DRAFT_FORMS: 'draftForms',
  IMAGE_CACHE: 'imageCache',
} as const;

// 타입 가드용 유틸리티
export type TeamMember = typeof TEAM_MEMBERS[number];
export type Process = typeof PROCESS_LIST[number];
export type PaymentProcess = typeof PAYMENT_PROCESS_LIST[number];
export type ProjectStatus = typeof PROJECT_STATUS[keyof typeof PROJECT_STATUS];
export type PaymentMethod = typeof PAYMENT_METHODS[keyof typeof PAYMENT_METHODS];