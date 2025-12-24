import { db, storage } from '../../config/firebase';
import {
  collection,
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  serverTimestamp,
  Timestamp
} from 'firebase/firestore';
import {
  ref,
  uploadBytes,
  getDownloadURL
} from 'firebase/storage';

export interface DrawingData {
  type: string;
  projectId: string;
  imageUrl: string;
  imageUrls?: string[];
  markers: any[];
  rooms: any[];
  lastModified: Date;
  naverTypeSqm?: string;
  naverTypePyeong?: string;
  naverArea?: string;
}

// Firestore 타임스탬프를 Date로 변환
const timestampToDate = (timestamp: Timestamp | string | undefined): Date => {
  if (!timestamp) return new Date();
  if (typeof timestamp === 'string') return new Date(timestamp);
  if (timestamp instanceof Timestamp) {
    return timestamp.toDate();
  }
  return new Date();
};

const drawingFirestoreService = {
  // 이미지 파일 업로드 (Firebase Storage)
  async uploadImage(file: File): Promise<string> {
    try {
      const filename = `drawings/${Date.now()}-${file.name}`;
      const storageRef = ref(storage, filename);

      await uploadBytes(storageRef, file);
      const downloadUrl = await getDownloadURL(storageRef);

      console.log('✅ [Firestore] 이미지 업로드 성공:', downloadUrl);
      return downloadUrl;
    } catch (error: any) {
      console.error('[Firestore] 이미지 업로드 실패:', error);
      throw new Error(`이미지 업로드 실패: ${error.message || '알 수 없는 오류'}`);
    }
  },

  // 도면 데이터 저장
  async setItem(projectId: string, type: string, data: Omit<DrawingData, 'lastModified'>): Promise<void> {
    try {
      console.log('[drawingFirestoreService] 도면 저장 요청:', {
        projectId,
        type,
        imageUrl: data.imageUrl ? 'provided' : 'none',
        markersCount: data.markers?.length || 0,
        roomsCount: data.rooms?.length || 0
      });

      // 문서 ID: projectId_type (하이픈을 언더스코어로 변환)
      const docId = `${projectId}_${type.replace(/-/g, '_')}`;
      const docRef = doc(db, 'drawings', docId);

      await setDoc(docRef, {
        projectId,
        type,
        imageUrl: data.imageUrl,
        imageUrls: data.imageUrls || [],
        markers: data.markers || [],
        rooms: data.rooms || [],
        naverTypeSqm: data.naverTypeSqm || null,
        naverTypePyeong: data.naverTypePyeong || null,
        naverArea: data.naverArea || null,
        updatedAt: serverTimestamp(),
        createdAt: serverTimestamp()
      }, { merge: true });

      console.log('✅ [Firestore] 도면 데이터 저장 성공');
    } catch (error: any) {
      console.error('[Firestore] 서버 도면 저장 실패:', error);
      throw new Error(`저장 실패: ${error.message || '알 수 없는 오류'}`);
    }
  },

  // 도면 데이터 조회
  async getItem(projectId: string, type: string): Promise<DrawingData | null> {
    try {
      console.log(`[drawingFirestoreService] 도면 조회 요청: projectId=${projectId}, type=${type}`);

      const docId = `${projectId}_${type.replace(/-/g, '_')}`;
      const docRef = doc(db, 'drawings', docId);
      const docSnap = await getDoc(docRef);

      if (!docSnap.exists()) {
        console.log('[drawingFirestoreService] 도면 데이터 없음');
        return null;
      }

      const serverData = docSnap.data();

      return {
        type: serverData.type,
        projectId: serverData.projectId,
        imageUrl: serverData.imageUrl,
        imageUrls: serverData.imageUrls || [],
        markers: serverData.markers || [],
        rooms: serverData.rooms || [],
        lastModified: timestampToDate(serverData.updatedAt),
        naverTypeSqm: serverData.naverTypeSqm,
        naverTypePyeong: serverData.naverTypePyeong,
        naverArea: serverData.naverArea
      };
    } catch (error: any) {
      console.error('[Firestore] 서버 도면 조회 실패:', error);
      throw error;
    }
  },

  // 도면 데이터 삭제
  async removeItem(projectId: string, type: string): Promise<void> {
    try {
      const docId = `${projectId}_${type.replace(/-/g, '_')}`;
      const docRef = doc(db, 'drawings', docId);
      await deleteDoc(docRef);
      console.log('✅ [Firestore] 도면 삭제 성공');
    } catch (error: any) {
      console.error('[Firestore] 서버 도면 삭제 실패:', error);
      throw error;
    }
  }
};

export default drawingFirestoreService;
