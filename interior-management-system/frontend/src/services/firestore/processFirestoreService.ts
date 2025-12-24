import { db } from '../../config/firebase';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  serverTimestamp,
  onSnapshot
} from 'firebase/firestore';

export interface ProcessItem {
  id: number;
  name: string;
  order: number;
  isDefault?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

const processFirestoreService = {
  // 공정 목록 조회
  async getAllProcesses(): Promise<ProcessItem[]> {
    try {
      const processesRef = collection(db, 'processes');
      const q = query(processesRef, orderBy('order', 'asc'));
      const snapshot = await getDocs(q);

      if (snapshot.empty) {
        // 기본 공정 목록 반환
        return this.getDefaultProcesses();
      }

      return snapshot.docs.map(docSnap => {
        const data = docSnap.data();
        return {
          id: parseInt(docSnap.id) || 0,
          name: data.name || '',
          order: data.order || 0,
          isDefault: data.isDefault || false,
          createdAt: data.createdAt,
          updatedAt: data.updatedAt
        };
      });
    } catch (error: any) {
      console.error('[Firestore] 공정 목록 조회 실패:', error);
      return this.getDefaultProcesses();
    }
  },

  // 기본 공정 목록
  getDefaultProcesses(): ProcessItem[] {
    const defaultProcesses = [
      '철거', '창호', '설비배관', '전기배선', '목공', '금속',
      '타일', '필름', '도배', '마루', '가구', '조명', '욕실',
      '도장', '청소', '준공검사'
    ];
    return defaultProcesses.map((name, index) => ({
      id: index + 1,
      name,
      order: index,
      isDefault: true
    }));
  },

  // 공정 생성
  async createProcess(name: string, order: number): Promise<ProcessItem> {
    try {
      // 새 ID 생성 (기존 최대 ID + 1)
      const processesRef = collection(db, 'processes');
      const snapshot = await getDocs(processesRef);
      let maxId = 0;
      snapshot.docs.forEach(docSnap => {
        const id = parseInt(docSnap.id);
        if (!isNaN(id) && id > maxId) maxId = id;
      });
      const newId = maxId + 1;

      const docRef = doc(db, 'processes', String(newId));
      const now = new Date().toISOString();

      await setDoc(docRef, {
        name,
        order,
        isDefault: false,
        createdAt: now,
        updatedAt: serverTimestamp()
      });

      console.log('✅ [Firestore] 공정 생성 성공:', newId);

      return {
        id: newId,
        name,
        order,
        isDefault: false,
        createdAt: now
      };
    } catch (error: any) {
      console.error('[Firestore] 공정 생성 실패:', error);
      throw new Error(`공정 생성 실패: ${error.message || '알 수 없는 오류'}`);
    }
  },

  // 공정 수정
  async updateProcess(id: number, data: Partial<ProcessItem>): Promise<ProcessItem> {
    try {
      const docRef = doc(db, 'processes', String(id));
      const docSnap = await getDoc(docRef);

      if (!docSnap.exists()) {
        throw new Error('공정을 찾을 수 없습니다.');
      }

      const existingData = docSnap.data();
      const updateData: Record<string, unknown> = {
        updatedAt: serverTimestamp()
      };

      if (data.name !== undefined) updateData.name = data.name;
      if (data.order !== undefined) updateData.order = data.order;

      await updateDoc(docRef, updateData);

      console.log('✅ [Firestore] 공정 수정 성공:', id);

      return {
        id,
        name: data.name ?? existingData.name,
        order: data.order ?? existingData.order,
        isDefault: existingData.isDefault
      };
    } catch (error: any) {
      console.error('[Firestore] 공정 수정 실패:', error);
      throw new Error(`공정 수정 실패: ${error.message || '알 수 없는 오류'}`);
    }
  },

  // 공정 삭제
  async deleteProcess(id: number): Promise<void> {
    try {
      const docRef = doc(db, 'processes', String(id));
      await deleteDoc(docRef);
      console.log('✅ [Firestore] 공정 삭제 성공:', id);
    } catch (error: any) {
      console.error('[Firestore] 공정 삭제 실패:', error);
      throw new Error(`공정 삭제 실패: ${error.message || '알 수 없는 오류'}`);
    }
  },

  // 공정 순서 변경
  async reorderProcesses(processIds: number[]): Promise<void> {
    try {
      const promises = processIds.map((processId, index) => {
        const docRef = doc(db, 'processes', String(processId));
        return updateDoc(docRef, {
          order: index,
          updatedAt: serverTimestamp()
        });
      });

      await Promise.all(promises);
      console.log('✅ [Firestore] 공정 순서 변경 성공');
    } catch (error: any) {
      console.error('[Firestore] 공정 순서 변경 실패:', error);
      throw new Error(`순서 변경 실패: ${error.message || '알 수 없는 오류'}`);
    }
  },

  // 공정 목록 실시간 구독
  subscribeToProcesses(callback: (processes: ProcessItem[]) => void): () => void {
    const processesRef = collection(db, 'processes');
    const q = query(processesRef, orderBy('order', 'asc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (snapshot.empty) {
        callback(processFirestoreService.getDefaultProcesses());
        return;
      }

      const processes = snapshot.docs.map(docSnap => {
        const data = docSnap.data();
        return {
          id: parseInt(docSnap.id) || 0,
          name: data.name || '',
          order: data.order || 0,
          isDefault: data.isDefault || false
        };
      });

      callback(processes);
    });

    return unsubscribe;
  }
};

export default processFirestoreService;
