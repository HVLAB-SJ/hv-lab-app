// IndexedDB를 사용한 도면 데이터 저장소
// localStorage의 5-10MB 제한을 넘어 수백MB까지 저장 가능

interface DrawingData {
  type: string;
  projectId: string;
  imageUrl: string;
  markers: any[];
  rooms: any[];
  lastModified: Date;
}

const DB_NAME = 'DrawingsDB';
const DB_VERSION = 1;
const STORE_NAME = 'drawings';

class DrawingStorage {
  private db: IDBDatabase | null = null;

  // IndexedDB 초기화
  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        console.error('IndexedDB 열기 실패:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // drawings 저장소가 없으면 생성
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const objectStore = db.createObjectStore(STORE_NAME, { keyPath: 'key' });
          objectStore.createIndex('userId', 'userId', { unique: false });
          objectStore.createIndex('projectId', 'projectId', { unique: false });
          objectStore.createIndex('type', 'type', { unique: false });
        }
      };
    });
  }

  // 데이터 저장
  async setItem(key: string, data: DrawingData, userId: string): Promise<void> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);

      const item = {
        key,
        userId,
        projectId: data.projectId,
        type: data.type,
        data,
        lastModified: new Date()
      };

      const request = store.put(item);

      request.onsuccess = () => resolve();
      request.onerror = () => {
        console.error('IndexedDB 저장 실패:', request.error);
        reject(request.error);
      };
    });
  }

  // 데이터 조회
  async getItem(key: string): Promise<DrawingData | null> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(key);

      request.onsuccess = () => {
        const result = request.result;
        resolve(result ? result.data : null);
      };

      request.onerror = () => {
        console.error('IndexedDB 조회 실패:', request.error);
        reject(request.error);
      };
    });
  }

  // 데이터 삭제
  async removeItem(key: string): Promise<void> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(key);

      request.onsuccess = () => resolve();
      request.onerror = () => {
        console.error('IndexedDB 삭제 실패:', request.error);
        reject(request.error);
      };
    });
  }

  // 모든 도면 데이터 삭제
  async clearAll(): Promise<number> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);

      // 먼저 모든 키를 가져옴
      const getAllRequest = store.getAllKeys();

      getAllRequest.onsuccess = () => {
        const keys = getAllRequest.result;
        const count = keys.length;

        // 모든 데이터 삭제
        const clearRequest = store.clear();

        clearRequest.onsuccess = () => resolve(count);
        clearRequest.onerror = () => {
          console.error('IndexedDB 전체 삭제 실패:', clearRequest.error);
          reject(clearRequest.error);
        };
      };

      getAllRequest.onerror = () => {
        console.error('IndexedDB 키 조회 실패:', getAllRequest.error);
        reject(getAllRequest.error);
      };
    });
  }

  // localStorage에서 IndexedDB로 데이터 마이그레이션
  async migrateFromLocalStorage(userId: string): Promise<number> {
    let migratedCount = 0;

    try {
      // localStorage에서 drawing- 으로 시작하는 모든 키 찾기
      const keysToMigrate: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('drawing-')) {
          keysToMigrate.push(key);
        }
      }

      // 각 항목을 IndexedDB로 이동
      for (const key of keysToMigrate) {
        try {
          const dataStr = localStorage.getItem(key);
          if (dataStr) {
            const data: DrawingData = JSON.parse(dataStr);
            await this.setItem(key, data, userId);
            localStorage.removeItem(key); // 마이그레이션 후 localStorage에서 삭제
            migratedCount++;
          }
        } catch (error) {
          console.error(`마이그레이션 실패 (${key}):`, error);
        }
      }

      console.log(`✅ ${migratedCount}개의 도면 데이터를 IndexedDB로 마이그레이션했습니다.`);
    } catch (error) {
      console.error('마이그레이션 중 오류:', error);
    }

    return migratedCount;
  }

  // 저장소 사용량 추정 (IndexedDB는 정확한 크기를 제공하지 않음)
  async estimateSize(): Promise<{ usage: number; quota: number }> {
    if ('storage' in navigator && 'estimate' in navigator.storage) {
      const estimate = await navigator.storage.estimate();
      return {
        usage: estimate.usage || 0,
        quota: estimate.quota || 0
      };
    }
    return { usage: 0, quota: 0 };
  }
}

// 싱글톤 인스턴스
export const drawingStorage = new DrawingStorage();
