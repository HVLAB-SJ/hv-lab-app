/**
 * localStorage 관련 유틸리티 함수들
 * 용량 제한 처리 및 안전한 저장/불러오기 기능 제공
 */

/**
 * localStorage에 데이터를 안전하게 저장
 * @param key - 저장할 키
 * @param value - 저장할 값 (자동으로 JSON 문자열로 변환)
 * @returns 저장 성공 여부
 */
export const safeLocalStorageSet = (key: string, value: any): boolean => {
  try {
    const serialized = typeof value === 'string' ? value : JSON.stringify(value);
    localStorage.setItem(key, serialized);
    return true;
  } catch (e) {
    if (e instanceof DOMException && e.name === 'QuotaExceededError') {
      console.error(`localStorage 용량 초과: ${key}`);
      // 용량 초과 시 정리 시도
      handleQuotaExceeded(key, value);
      return false;
    }
    console.error('localStorage 저장 실패:', e);
    return false;
  }
};

/**
 * localStorage에서 데이터를 안전하게 불러오기
 * @param key - 불러올 키
 * @param defaultValue - 기본값 (키가 없거나 파싱 실패 시 반환)
 * @returns 저장된 값 또는 기본값
 */
export const safeLocalStorageGet = <T = any>(key: string, defaultValue: T | null = null): T | null => {
  try {
    const item = localStorage.getItem(key);
    if (item === null) {
      return defaultValue;
    }

    // JSON 파싱 시도
    try {
      return JSON.parse(item) as T;
    } catch {
      // JSON이 아닌 일반 문자열인 경우
      return item as unknown as T;
    }
  } catch (e) {
    console.error(`localStorage 읽기 실패 (${key}):`, e);
    return defaultValue;
  }
};

/**
 * localStorage에서 키 삭제
 * @param key - 삭제할 키
 * @returns 삭제 성공 여부
 */
export const safeLocalStorageRemove = (key: string): boolean => {
  try {
    localStorage.removeItem(key);
    return true;
  } catch (e) {
    console.error(`localStorage 삭제 실패 (${key}):`, e);
    return false;
  }
};

/**
 * localStorage 용량 초과 시 처리
 * @param newKey - 새로 저장하려는 키
 * @param newValue - 새로 저장하려는 값
 */
const handleQuotaExceeded = (newKey: string, newValue: any): void => {
  console.warn('localStorage 용량 초과 - 오래된 데이터 정리 시도');

  // 이미지 관련 키들 우선 정리 (가장 용량이 큰 항목들)
  const imageKeys = [
    'paymentImages',
    'executionImages',
    'additionalWorkImages',
    'siteLogImages',
    'specbookImages'
  ];

  // 임시 데이터 키들
  const tempKeys = [
    'tempFormData',
    'draft_',
    'cache_'
  ];

  try {
    // 1. 이미지 데이터 정리
    for (const key of imageKeys) {
      if (key !== newKey) {
        localStorage.removeItem(key);
        console.log(`정리됨: ${key}`);
      }
    }

    // 2. 임시 데이터 정리
    const allKeys = Object.keys(localStorage);
    for (const key of allKeys) {
      if (tempKeys.some(temp => key.includes(temp))) {
        localStorage.removeItem(key);
        console.log(`임시 데이터 정리: ${key}`);
      }
    }

    // 3. 재시도
    try {
      const serialized = typeof newValue === 'string' ? newValue : JSON.stringify(newValue);
      localStorage.setItem(newKey, serialized);
      console.log('정리 후 저장 성공');
    } catch (e) {
      console.error('정리 후에도 저장 실패:', e);
    }
  } catch (e) {
    console.error('localStorage 정리 중 오류:', e);
  }
};

/**
 * localStorage 사용 용량 계산
 * @returns 사용 중인 용량 (bytes)
 */
export const getLocalStorageSize = (): number => {
  let size = 0;
  for (const key in localStorage) {
    if (localStorage.hasOwnProperty(key)) {
      const value = localStorage.getItem(key);
      if (value) {
        size += key.length + value.length;
      }
    }
  }
  return size * 2; // UTF-16으로 저장되므로 2배
};

/**
 * localStorage 사용 용량을 MB 단위로 반환
 * @returns 사용 중인 용량 (MB)
 */
export const getLocalStorageSizeMB = (): string => {
  const sizeInBytes = getLocalStorageSize();
  return (sizeInBytes / (1024 * 1024)).toFixed(2);
};

/**
 * localStorage 남은 용량 추정 (대략적)
 * 브라우저마다 다르지만 일반적으로 5-10MB
 * @returns 남은 용량 비율 (0-1)
 */
export const getLocalStorageRemainingSpace = (): number => {
  const maxSize = 5 * 1024 * 1024; // 5MB 가정
  const currentSize = getLocalStorageSize();
  const remaining = Math.max(0, maxSize - currentSize);
  return remaining / maxSize;
};

/**
 * 특정 키 패턴에 해당하는 모든 항목 삭제
 * @param pattern - 삭제할 키 패턴 (정규식 또는 문자열)
 * @returns 삭제된 항목 수
 */
export const clearLocalStorageByPattern = (pattern: string | RegExp): number => {
  const regex = typeof pattern === 'string' ? new RegExp(pattern) : pattern;
  const keys = Object.keys(localStorage);
  let deletedCount = 0;

  for (const key of keys) {
    if (regex.test(key)) {
      localStorage.removeItem(key);
      deletedCount++;
    }
  }

  return deletedCount;
};

/**
 * localStorage 전체 정리 (특정 키들 제외)
 * @param keepKeys - 유지할 키 배열
 */
export const clearLocalStorageExcept = (keepKeys: string[]): void => {
  const allKeys = Object.keys(localStorage);
  for (const key of allKeys) {
    if (!keepKeys.includes(key)) {
      localStorage.removeItem(key);
    }
  }
};

/**
 * 데이터를 압축하여 저장 (대용량 데이터용)
 * LZ-string 같은 라이브러리가 필요할 수 있음
 * @param key - 저장할 키
 * @param data - 저장할 데이터
 * @returns 저장 성공 여부
 */
export const setCompressedData = (key: string, data: any): boolean => {
  try {
    // 간단한 압축: 불필요한 공백 제거
    const compressed = JSON.stringify(data).replace(/\s+/g, ' ');
    return safeLocalStorageSet(key, compressed);
  } catch (e) {
    console.error('데이터 압축 저장 실패:', e);
    return false;
  }
};

/**
 * 만료 시간과 함께 데이터 저장
 * @param key - 저장할 키
 * @param value - 저장할 값
 * @param expiryMinutes - 만료 시간 (분)
 * @returns 저장 성공 여부
 */
export const setWithExpiry = (key: string, value: any, expiryMinutes: number): boolean => {
  const now = new Date();
  const item = {
    value: value,
    expiry: now.getTime() + expiryMinutes * 60000,
  };
  return safeLocalStorageSet(key, item);
};

/**
 * 만료 시간이 있는 데이터 불러오기
 * @param key - 불러올 키
 * @returns 저장된 값 또는 null (만료된 경우)
 */
export const getWithExpiry = <T = any>(key: string): T | null => {
  const itemStr = localStorage.getItem(key);
  if (!itemStr) {
    return null;
  }

  try {
    const item = JSON.parse(itemStr);
    const now = new Date();

    if (now.getTime() > item.expiry) {
      localStorage.removeItem(key);
      return null;
    }

    return item.value as T;
  } catch {
    return null;
  }
};