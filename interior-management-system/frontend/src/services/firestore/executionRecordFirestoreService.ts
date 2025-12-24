/**
 * 실행내역 Firestore 서비스
 */
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
  where,
  onSnapshot,
  Unsubscribe
} from 'firebase/firestore';
import { COLLECTIONS } from './index';

// 프로젝트 캐시 (name -> id 매핑)
let projectNameToIdCache: Map<string, number> = new Map();
let projectCachePromise: Promise<void> | null = null;

async function loadProjectCache(): Promise<void> {
  if (projectNameToIdCache.size > 0) return;
  if (projectCachePromise) return projectCachePromise;

  projectCachePromise = (async () => {
    try {
      const projectsRef = collection(db, COLLECTIONS.PROJECTS);
      const querySnapshot = await getDocs(projectsRef);

      querySnapshot.docs.forEach(doc => {
        const data = doc.data();
        const id = parseInt(doc.id);
        if (!isNaN(id) && data.name) {
          projectNameToIdCache.set(data.name, id);
        }
      });
      console.log('[executionRecordFirestoreService] 프로젝트 캐시 로드 완료:', projectNameToIdCache.size, '개');
    } catch (error) {
      console.error('[executionRecordFirestoreService] 프로젝트 캐시 로드 실패:', error);
      projectCachePromise = null;
      throw error;
    }
  })();

  return projectCachePromise;
}

// Firestore 실행내역 타입
export interface FirestoreExecutionRecord {
  id: number;
  projectId: number;
  projectName: string;
  author: string;
  date: string;
  process: string;
  itemName: string;
  materialCost: number;
  laborCost: number;
  vatAmount: number;
  totalAmount: number;
  notes: string;
  paymentId: number | null;
  includesTaxDeduction: boolean;
  includesVAT: boolean;
  createdAt: string;
  updatedAt: string;
  images: string[];
  imageCount: number;
}

// 기존 API 응답 형식과 호환되는 타입
export interface ExecutionRecordResponse {
  id: number;
  project_id: number;
  project_name: string;
  author: string;
  date: string;
  process: string;
  item_name: string;
  material_cost: number;
  labor_cost: number;
  vat_amount: number;
  total_amount: number;
  notes: string;
  images: string[];
  payment_id: number | null;
  includes_tax_deduction: number; // 0 or 1
  includes_vat: number; // 0 or 1
  created_at: string;
  updated_at: string;
}

// Firestore 데이터를 API 응답 형식으로 변환
function convertToRecordResponse(firestoreData: FirestoreExecutionRecord): ExecutionRecordResponse {
  return {
    id: firestoreData.id,
    project_id: firestoreData.projectId,
    project_name: firestoreData.projectName || '',
    author: firestoreData.author || '',
    date: firestoreData.date || '',
    process: firestoreData.process || '',
    item_name: firestoreData.itemName || '',
    material_cost: firestoreData.materialCost || 0,
    labor_cost: firestoreData.laborCost || 0,
    vat_amount: firestoreData.vatAmount || 0,
    total_amount: firestoreData.totalAmount || 0,
    notes: firestoreData.notes || '',
    images: firestoreData.images || [],
    payment_id: firestoreData.paymentId,
    includes_tax_deduction: firestoreData.includesTaxDeduction ? 1 : 0,
    includes_vat: firestoreData.includesVAT ? 1 : 0,
    created_at: firestoreData.createdAt || '',
    updated_at: firestoreData.updatedAt || ''
  };
}

// API 요청 형식을 Firestore 형식으로 변환
function convertToFirestoreFormat(data: Record<string, unknown>): Partial<FirestoreExecutionRecord> {
  const result: Partial<FirestoreExecutionRecord> = {};

  if (data.project_id !== undefined) result.projectId = data.project_id as number;
  if (data.projectId !== undefined) result.projectId = data.projectId as number;
  if (data.project_name !== undefined) result.projectName = data.project_name as string;
  if (data.projectName !== undefined) result.projectName = data.projectName as string;
  if (data.author !== undefined) result.author = data.author as string;
  if (data.date !== undefined) result.date = data.date as string;
  if (data.process !== undefined) result.process = data.process as string;
  if (data.item_name !== undefined) result.itemName = data.item_name as string;
  if (data.itemName !== undefined) result.itemName = data.itemName as string;
  if (data.material_cost !== undefined) result.materialCost = data.material_cost as number;
  if (data.materialCost !== undefined) result.materialCost = data.materialCost as number;
  if (data.labor_cost !== undefined) result.laborCost = data.labor_cost as number;
  if (data.laborCost !== undefined) result.laborCost = data.laborCost as number;
  if (data.vat_amount !== undefined) result.vatAmount = data.vat_amount as number;
  if (data.vatAmount !== undefined) result.vatAmount = data.vatAmount as number;
  if (data.total_amount !== undefined) result.totalAmount = data.total_amount as number;
  if (data.totalAmount !== undefined) result.totalAmount = data.totalAmount as number;
  if (data.notes !== undefined) result.notes = data.notes as string;
  if (data.images !== undefined) result.images = data.images as string[];
  if (data.payment_id !== undefined) result.paymentId = data.payment_id as number | null;
  if (data.paymentId !== undefined) result.paymentId = data.paymentId as number | null;
  if (data.includes_tax_deduction !== undefined) {
    result.includesTaxDeduction = data.includes_tax_deduction === true || data.includes_tax_deduction === 1;
  }
  if (data.includesTaxDeduction !== undefined) {
    result.includesTaxDeduction = data.includesTaxDeduction as boolean;
  }
  if (data.includes_vat !== undefined) {
    result.includesVAT = data.includes_vat === true || data.includes_vat === 1;
  }
  if (data.includesVAT !== undefined) {
    result.includesVAT = data.includesVAT as boolean;
  }

  return result;
}

const executionRecordFirestoreService = {
  // 모든 실행내역 조회
  getAllRecords: async (): Promise<ExecutionRecordResponse[]> => {
    const collectionRef = collection(db, COLLECTIONS.EXECUTION_RECORDS);
    const q = query(collectionRef, orderBy('id', 'desc'));
    const querySnapshot = await getDocs(q);

    return querySnapshot.docs.map(doc => {
      const data = doc.data() as FirestoreExecutionRecord;
      return convertToRecordResponse({ ...data, id: parseInt(doc.id) || data.id });
    });
  },

  // 단일 실행내역 조회
  getRecordById: async (id: string): Promise<ExecutionRecordResponse | null> => {
    const docRef = doc(db, COLLECTIONS.EXECUTION_RECORDS, id);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      const data = docSnap.data() as FirestoreExecutionRecord;
      return convertToRecordResponse({ ...data, id: parseInt(docSnap.id) || data.id });
    }
    return null;
  },

  // 실행내역 생성
  createRecord: async (data: Record<string, unknown>): Promise<ExecutionRecordResponse> => {
    // 프로젝트 캐시 로드
    await loadProjectCache();

    // 새 문서 ID 생성 (현재 최대 ID + 1)
    const collectionRef = collection(db, COLLECTIONS.EXECUTION_RECORDS);
    const querySnapshot = await getDocs(collectionRef);

    let maxId = 0;
    querySnapshot.docs.forEach(doc => {
      const id = parseInt(doc.id);
      if (!isNaN(id) && id > maxId) {
        maxId = id;
      }
    });
    const newId = maxId + 1;

    const firestoreData = convertToFirestoreFormat(data);
    const now = new Date().toISOString();

    // 프로젝트 이름으로 ID 조회 (projectId가 없거나 0인 경우)
    let resolvedProjectId = firestoreData.projectId || 0;
    const resolvedProjectName = firestoreData.projectName || '';

    if ((!resolvedProjectId || resolvedProjectId === 0) && resolvedProjectName) {
      const cachedId = projectNameToIdCache.get(resolvedProjectName);
      if (cachedId) {
        resolvedProjectId = cachedId;
        console.log('[executionRecordFirestoreService] 프로젝트명으로 ID 조회:', resolvedProjectName, '->', resolvedProjectId);
      } else {
        console.warn('[executionRecordFirestoreService] 프로젝트명에 해당하는 ID를 찾을 수 없음:', resolvedProjectName);
      }
    }

    const newRecord: FirestoreExecutionRecord = {
      id: newId,
      projectId: resolvedProjectId,
      projectName: resolvedProjectName,
      author: firestoreData.author || '',
      date: firestoreData.date || now.split('T')[0],
      process: firestoreData.process || '',
      itemName: firestoreData.itemName || '',
      materialCost: firestoreData.materialCost || 0,
      laborCost: firestoreData.laborCost || 0,
      vatAmount: firestoreData.vatAmount || 0,
      totalAmount: firestoreData.totalAmount || 0,
      notes: firestoreData.notes || '',
      paymentId: firestoreData.paymentId || null,
      includesTaxDeduction: firestoreData.includesTaxDeduction || false,
      includesVAT: firestoreData.includesVAT || false,
      createdAt: now,
      updatedAt: now,
      images: firestoreData.images || [],
      imageCount: firestoreData.images?.length || 0
    };

    const docRef = doc(db, COLLECTIONS.EXECUTION_RECORDS, String(newId));
    await setDoc(docRef, newRecord);

    return convertToRecordResponse(newRecord);
  },

  // 실행내역 수정
  updateRecord: async (id: string, data: Record<string, unknown>): Promise<ExecutionRecordResponse> => {
    const docRef = doc(db, COLLECTIONS.EXECUTION_RECORDS, id);
    const firestoreData = convertToFirestoreFormat(data);

    await updateDoc(docRef, {
      ...firestoreData,
      updatedAt: new Date().toISOString()
    });

    // 업데이트된 데이터 반환
    const updated = await executionRecordFirestoreService.getRecordById(id);
    if (!updated) {
      throw new Error('Execution record not found after update');
    }
    return updated;
  },

  // 실행내역 삭제
  deleteRecord: async (id: string): Promise<void> => {
    const docRef = doc(db, COLLECTIONS.EXECUTION_RECORDS, id);
    await deleteDoc(docRef);
  },

  // 실시간 실행내역 목록 구독
  subscribeToRecords: (callback: (records: ExecutionRecordResponse[]) => void): Unsubscribe => {
    const collectionRef = collection(db, COLLECTIONS.EXECUTION_RECORDS);
    const q = query(collectionRef, orderBy('id', 'desc'));

    return onSnapshot(q, (snapshot) => {
      const records = snapshot.docs.map(doc => {
        const data = doc.data() as FirestoreExecutionRecord;
        return convertToRecordResponse({ ...data, id: parseInt(doc.id) || data.id });
      });
      callback(records);
    });
  },

  // 프로젝트별 실행내역 조회
  getRecordsByProject: async (projectId: number): Promise<ExecutionRecordResponse[]> => {
    const collectionRef = collection(db, COLLECTIONS.EXECUTION_RECORDS);
    const q = query(
      collectionRef,
      where('projectId', '==', projectId),
      orderBy('id', 'desc')
    );
    const querySnapshot = await getDocs(q);

    return querySnapshot.docs.map(doc => {
      const data = doc.data() as FirestoreExecutionRecord;
      return convertToRecordResponse({ ...data, id: parseInt(doc.id) || data.id });
    });
  },

  // 결제요청 ID로 실행내역 조회
  getRecordByPaymentId: async (paymentId: number): Promise<ExecutionRecordResponse | null> => {
    const collectionRef = collection(db, COLLECTIONS.EXECUTION_RECORDS);
    const q = query(
      collectionRef,
      where('paymentId', '==', paymentId)
    );
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      return null;
    }

    const docData = querySnapshot.docs[0];
    const data = docData.data() as FirestoreExecutionRecord;
    return convertToRecordResponse({ ...data, id: parseInt(docData.id) || data.id });
  }
};

export default executionRecordFirestoreService;
