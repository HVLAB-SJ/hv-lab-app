// 서버 기반 도면 데이터 저장소
// Firebase Firestore 전용

import drawingFirestoreService from '../services/firestore/drawingFirestoreService';

interface DrawingData {
  type: string;
  projectId: string;
  imageUrl: string;
  imageUrls?: string[]; // 다중 이미지 지원
  markers: any[];
  rooms: any[];
  lastModified: Date;
  // 네이버도면 전용 필드
  naverTypeSqm?: string;
  naverTypePyeong?: string;
  naverArea?: string;
}

class DrawingStorage {
  // 이미지 파일 업로드
  async uploadImage(file: File): Promise<string> {
    try {
      return await drawingFirestoreService.uploadImage(file);
    } catch (error: any) {
      console.error('이미지 업로드 실패:', error);
      const errorMsg = error.message || '알 수 없는 오류';
      throw new Error(`이미지 업로드 실패: ${errorMsg}`);
    }
  }

  // 도면 데이터 저장 (이미지 URL 방식)
  async setItem(key: string, data: DrawingData, userId: string): Promise<void> {
    try {
      console.log('[drawingStorage] 도면 저장 요청:', {
        projectId: data.projectId,
        type: data.type,
        imageUrl: data.imageUrl ? 'provided' : 'none',
        markersCount: data.markers?.length || 0,
        roomsCount: data.rooms?.length || 0
      });

      await drawingFirestoreService.setItem(data.projectId, data.type, data);
      console.log('✅ 도면 데이터 저장 성공');
    } catch (error: any) {
      console.error('서버 도면 저장 실패:', error);
      const errorMsg = error.message || '저장 실패';
      throw new Error(errorMsg);
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

      console.log(`[drawingStorage] 도면 조회 요청: projectId=${projectId}, type=${type}`);

      return await drawingFirestoreService.getItem(projectId, type);
    } catch (error: any) {
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

      await drawingFirestoreService.removeItem(projectId, type);
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

  // localStorage에서 서버로 데이터 마이그레이션 (더 이상 사용 안함)
  async migrateFromLocalStorage(userId: string): Promise<number> {
    // 기존 localStorage 데이터 정리만 수행
    let cleanedCount = 0;
    const keysToRemove: string[] = [];

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('drawing-')) {
        keysToRemove.push(key);
      }
    }

    keysToRemove.forEach(key => {
      localStorage.removeItem(key);
      cleanedCount++;
    });

    if (cleanedCount > 0) {
      console.log(`✅ ${cleanedCount}개의 로컬 도면 데이터를 정리했습니다.`);
    }

    return cleanedCount;
  }

  // 저장소 사용량 추정 (서버에서는 의미 없음)
  async estimateSize(): Promise<{ usage: number; quota: number }> {
    return { usage: 0, quota: 0 };
  }
}

// 싱글톤 인스턴스
export const drawingStorage = new DrawingStorage();
