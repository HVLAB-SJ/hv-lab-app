// 서버 기반 도면 데이터 저장소
// 모든 기기에서 동기화되는 서버 저장 방식

import api from '../services/api';

interface DrawingData {
  type: string;
  projectId: string;
  imageUrl: string;
  markers: any[];
  rooms: any[];
  lastModified: Date;
  // 네이버도면 전용 필드
  naverTypeSqm?: string;
  naverTypePyeong?: string;
  naverArea?: string;
}

class DrawingStorage {
  // 데이터 저장 (서버 API 호출)
  async setItem(key: string, data: DrawingData, userId: string): Promise<void> {
    try {
      await api.post('/drawings', {
        projectId: data.projectId,
        type: data.type,
        imageUrl: data.imageUrl,
        markers: data.markers,
        rooms: data.rooms,
        naverTypeSqm: data.naverTypeSqm,
        naverTypePyeong: data.naverTypePyeong,
        naverArea: data.naverArea
      });
    } catch (error) {
      console.error('서버 도면 저장 실패:', error);
      throw error;
    }
  }

  // 데이터 조회 (서버 API 호출)
  async getItem(key: string): Promise<DrawingData | null> {
    try {
      // key 형식: drawing-{userId}-{projectId}-{type}
      const parts = key.split('-');
      if (parts.length < 4) {
        console.error('잘못된 키 형식:', key);
        return null;
      }

      // projectId와 type 추출
      const projectId = parts[2];
      const type = parts.slice(3).join('-'); // type에 하이픈이 있을 수 있음

      const response = await api.get(`/drawings/${projectId}/${encodeURIComponent(type)}`);

      const serverData = response.data;

      return {
        type: serverData.type,
        projectId: serverData.projectId,
        imageUrl: serverData.imageUrl,
        markers: serverData.markers || [],
        rooms: serverData.rooms || [],
        lastModified: new Date(serverData.updatedAt),
        naverTypeSqm: serverData.naverTypeSqm,
        naverTypePyeong: serverData.naverTypePyeong,
        naverArea: serverData.naverArea
      };
    } catch (error: any) {
      // 404는 데이터가 없는 것이므로 null 반환
      if (error.response?.status === 404) {
        return null;
      }
      console.error('서버 도면 조회 실패:', error);
      throw error;
    }
  }

  // 데이터 삭제 (서버 API 호출)
  async removeItem(key: string): Promise<void> {
    try {
      // key 형식: drawing-{userId}-{projectId}-{type}
      const parts = key.split('-');
      if (parts.length < 4) {
        console.error('잘못된 키 형식:', key);
        return;
      }

      const projectId = parts[2];
      const type = parts.slice(3).join('-');

      await api.delete(`/drawings/${projectId}/${encodeURIComponent(type)}`);
    } catch (error) {
      console.error('서버 도면 삭제 실패:', error);
      throw error;
    }
  }

  // 모든 도면 데이터 삭제 (사용 안함 - 서버에서 관리)
  async clearAll(): Promise<number> {
    console.warn('서버 기반 저장소에서는 clearAll이 지원되지 않습니다.');
    return 0;
  }

  // localStorage에서 서버로 데이터 마이그레이션
  async migrateFromLocalStorage(userId: string): Promise<number> {
    let migratedCount = 0;

    try {
      // IndexedDB 마이그레이션도 시도
      await this.migrateFromIndexedDB(userId);

      // localStorage에서 drawing- 으로 시작하는 모든 키 찾기
      const keysToMigrate: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('drawing-')) {
          keysToMigrate.push(key);
        }
      }

      // 각 항목을 서버로 이동
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

      if (migratedCount > 0) {
        console.log(`✅ ${migratedCount}개의 도면 데이터를 서버로 마이그레이션했습니다.`);
      }
    } catch (error) {
      console.error('마이그레이션 중 오류:', error);
    }

    return migratedCount;
  }

  // IndexedDB에서 서버로 데이터 마이그레이션
  private async migrateFromIndexedDB(userId: string): Promise<number> {
    let migratedCount = 0;

    try {
      const DB_NAME = 'DrawingsDB';
      const STORE_NAME = 'drawings';

      // IndexedDB가 존재하는지 확인
      const databases = await indexedDB.databases();
      const dbExists = databases.some(db => db.name === DB_NAME);

      if (!dbExists) {
        return 0;
      }

      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, 1);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
      });

      // 모든 데이터 가져오기
      const items = await new Promise<any[]>((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.getAll();
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result || []);
      });

      // 각 항목을 서버로 마이그레이션
      for (const item of items) {
        try {
          if (item.data && item.data.imageUrl) {
            await this.setItem(item.key, item.data, userId);
            migratedCount++;
          }
        } catch (error) {
          console.error(`IndexedDB 마이그레이션 실패 (${item.key}):`, error);
        }
      }

      // 마이그레이션 완료 후 IndexedDB 삭제
      if (migratedCount > 0) {
        db.close();
        await new Promise<void>((resolve, reject) => {
          const deleteRequest = indexedDB.deleteDatabase(DB_NAME);
          deleteRequest.onerror = () => reject(deleteRequest.error);
          deleteRequest.onsuccess = () => resolve();
        });
        console.log(`✅ IndexedDB에서 ${migratedCount}개의 도면을 서버로 마이그레이션하고 로컬 DB를 삭제했습니다.`);
      }

      db.close();
    } catch (error) {
      console.error('IndexedDB 마이그레이션 중 오류:', error);
    }

    return migratedCount;
  }

  // 저장소 사용량 추정 (서버에서는 의미 없음)
  async estimateSize(): Promise<{ usage: number; quota: number }> {
    return { usage: 0, quota: 0 };
  }
}

// 싱글톤 인스턴스
export const drawingStorage = new DrawingStorage();
