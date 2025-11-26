// IndexedDB를 사용한 이미지 저장소 (localStorage 5MB 제한 우회)

const DB_NAME = 'HVLabImageDB';
const DB_VERSION = 1;
const STORE_NAME = 'paymentRecordImages';

let db: IDBDatabase | null = null;

// DB 초기화
const initDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    if (db) {
      resolve(db);
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      console.error('IndexedDB 열기 실패:', request.error);
      reject(request.error);
    };

    request.onsuccess = () => {
      db = request.result;
      resolve(db);
    };

    request.onupgradeneeded = (event) => {
      const database = (event.target as IDBOpenDBRequest).result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
  });
};

// 모든 이미지 데이터 가져오기
export const getAllImages = async (): Promise<Record<string, string[]>> => {
  try {
    const database = await initDB();
    return new Promise((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAll();

      request.onsuccess = () => {
        const result: Record<string, string[]> = {};
        request.result.forEach((item: { id: string; images: string[] }) => {
          result[item.id] = item.images;
        });
        resolve(result);
      };

      request.onerror = () => {
        console.error('이미지 로드 실패:', request.error);
        reject(request.error);
      };
    });
  } catch (error) {
    console.error('IndexedDB 오류, localStorage 폴백:', error);
    // IndexedDB 실패 시 localStorage 폴백
    const stored = localStorage.getItem('paymentRecordImages');
    return stored ? JSON.parse(stored) : {};
  }
};

// 특정 레코드의 이미지 저장
export const saveImages = async (recordId: string, images: string[]): Promise<void> => {
  try {
    const database = await initDB();
    return new Promise((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put({ id: recordId, images });

      request.onsuccess = () => resolve();
      request.onerror = () => {
        console.error('이미지 저장 실패:', request.error);
        reject(request.error);
      };
    });
  } catch (error) {
    console.error('IndexedDB 저장 오류:', error);
    throw error;
  }
};

// 특정 레코드의 이미지 삭제
export const deleteImages = async (recordId: string): Promise<void> => {
  try {
    const database = await initDB();
    return new Promise((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(recordId);

      request.onsuccess = () => resolve();
      request.onerror = () => {
        console.error('이미지 삭제 실패:', request.error);
        reject(request.error);
      };
    });
  } catch (error) {
    console.error('IndexedDB 삭제 오류:', error);
    throw error;
  }
};

// 전체 이미지 데이터 저장 (마이그레이션 또는 대량 업데이트용)
export const saveAllImages = async (data: Record<string, string[]>): Promise<void> => {
  try {
    const database = await initDB();
    return new Promise((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);

      // 기존 데이터 모두 삭제
      store.clear();

      // 새 데이터 추가
      Object.entries(data).forEach(([id, images]) => {
        store.put({ id, images });
      });

      transaction.oncomplete = () => resolve();
      transaction.onerror = () => {
        console.error('전체 저장 실패:', transaction.error);
        reject(transaction.error);
      };
    });
  } catch (error) {
    console.error('IndexedDB 전체 저장 오류:', error);
    throw error;
  }
};

// localStorage에서 IndexedDB로 마이그레이션
export const migrateFromLocalStorage = async (): Promise<void> => {
  try {
    const stored = localStorage.getItem('paymentRecordImages');
    if (stored) {
      const data = JSON.parse(stored);
      if (Object.keys(data).length > 0) {
        await saveAllImages(data);
        // 마이그레이션 성공 후 localStorage 정리
        localStorage.removeItem('paymentRecordImages');
        console.log('localStorage에서 IndexedDB로 마이그레이션 완료');
      }
    }
  } catch (error) {
    console.error('마이그레이션 실패:', error);
  }
};
