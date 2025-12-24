/**
 * 데이터 소스 설정
 *
 * Railway API와 Firestore 간에 쉽게 전환할 수 있게 합니다.
 *
 * 사용법:
 * 1. USE_FIRESTORE = true: Firestore 직접 접근 (서버리스, 실시간)
 * 2. USE_FIRESTORE = false: Railway API 사용 (기존 방식)
 */

// 데이터 소스 설정 - true: Firestore, false: Railway API
export const USE_FIRESTORE = true;

// 환경변수로도 오버라이드 가능
export const getDataSourceConfig = () => {
  // 환경변수가 설정되어 있으면 해당 값 사용
  const envValue = import.meta.env.VITE_USE_FIRESTORE;
  if (envValue !== undefined) {
    return envValue === 'true';
  }
  return USE_FIRESTORE;
};

// 현재 데이터 소스 상태 로깅
export const logDataSource = () => {
  const useFirestore = getDataSourceConfig();
  console.log(`[DataSource] Using ${useFirestore ? 'Firestore' : 'Railway API'}`);
};
