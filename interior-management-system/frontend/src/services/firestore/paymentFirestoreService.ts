/**
 * 결제요청 Firestore 서비스
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

// Firestore 결제요청 타입
export interface FirestorePayment {
  id: number;
  projectId: number;
  userId: number;
  requestType: string;
  vendorName: string;
  description: string;
  amount: number;
  accountHolder: string;
  bankName: string;
  accountNumber: string;
  status: 'pending' | 'reviewing' | 'approved' | 'on-hold' | 'rejected' | 'completed';
  approvedBy: number | null;
  paidAt: string | null;
  receiptUrl: string | null;
  notes: string;
  createdAt: string;
  updatedAt: string;
  applyTaxDeduction: boolean;
  materialAmount: number;
  laborAmount: number;
  originalMaterialAmount: number;
  originalLaborAmount: number;
  itemName: string;
  includesVAT: boolean;
  quickText: string;
  images: string[];
  imageCount: number;
}

// 기존 API 응답 형식과 호환되는 타입
export interface PaymentResponse {
  id: number;
  project_id: number;
  project_name: string;
  project_color: string;
  user_id: number;
  requester_name: string;
  approver_name?: string;
  approved_by?: number;
  request_type: string;
  vendor_name: string;
  description: string;
  amount: number;
  account_holder: string;
  bank_name: string;
  account_number: string;
  item_name?: string;
  material_amount?: number;
  labor_amount?: number;
  original_material_amount?: number;
  original_labor_amount?: number;
  apply_tax_deduction?: number;
  includes_vat?: number;
  quick_text?: string;
  images?: string;
  notes: string;
  status: 'pending' | 'reviewing' | 'approved' | 'on-hold' | 'rejected' | 'completed';
  created_at: string;
  updated_at: string;
  approved_at?: string;
  paid_at?: string;
}

// 프로젝트 정보 캐시
let projectsCache: Map<string, { name: string; color: string }> = new Map();

async function loadProjectsCache(): Promise<void> {
  if (projectsCache.size > 0) return;

  const projectsRef = collection(db, COLLECTIONS.PROJECTS);
  const querySnapshot = await getDocs(projectsRef);

  querySnapshot.docs.forEach(doc => {
    const data = doc.data();
    projectsCache.set(doc.id, {
      name: data.name || '',
      color: data.color || '#4A90E2'
    });
  });
}

// Firestore 데이터를 API 응답 형식으로 변환
function convertToPaymentResponse(firestoreData: FirestorePayment): PaymentResponse {
  const project = projectsCache.get(String(firestoreData.projectId)) || { name: '', color: '#4A90E2' };

  return {
    id: firestoreData.id,
    project_id: firestoreData.projectId,
    project_name: project.name,
    project_color: project.color,
    user_id: firestoreData.userId || 0,
    requester_name: '', // 사용자 정보는 별도 조회 필요
    approved_by: firestoreData.approvedBy || undefined,
    request_type: firestoreData.requestType || 'material',
    vendor_name: firestoreData.vendorName || '',
    description: firestoreData.description || '',
    amount: firestoreData.amount || 0,
    account_holder: firestoreData.accountHolder || '',
    bank_name: firestoreData.bankName || '',
    account_number: firestoreData.accountNumber || '',
    item_name: firestoreData.itemName || '',
    material_amount: firestoreData.materialAmount || 0,
    labor_amount: firestoreData.laborAmount || 0,
    original_material_amount: firestoreData.originalMaterialAmount || 0,
    original_labor_amount: firestoreData.originalLaborAmount || 0,
    apply_tax_deduction: firestoreData.applyTaxDeduction ? 1 : 0,
    includes_vat: firestoreData.includesVAT ? 1 : 0,
    quick_text: firestoreData.quickText || '',
    images: firestoreData.images ? JSON.stringify(firestoreData.images) : '[]',
    notes: firestoreData.notes || '',
    status: firestoreData.status || 'pending',
    created_at: firestoreData.createdAt || '',
    updated_at: firestoreData.updatedAt || '',
    paid_at: firestoreData.paidAt || undefined
  };
}

// API 요청 형식을 Firestore 형식으로 변환
function convertToFirestoreFormat(data: Record<string, unknown>): Partial<FirestorePayment> {
  const result: Partial<FirestorePayment> = {};

  if (data.project_id !== undefined) result.projectId = data.project_id as number;
  if (data.projectId !== undefined) result.projectId = data.projectId as number;
  if (data.request_type !== undefined) result.requestType = data.request_type as string;
  if (data.category !== undefined) result.requestType = data.category as string;
  if (data.vendor_name !== undefined) result.vendorName = data.vendor_name as string;
  if (data.process !== undefined) result.vendorName = data.process as string;
  if (data.description !== undefined) result.description = data.description as string;
  if (data.purpose !== undefined) result.description = data.purpose as string;
  if (data.amount !== undefined) result.amount = data.amount as number;
  if (data.account_holder !== undefined) result.accountHolder = data.account_holder as string;
  if (data.bank_name !== undefined) result.bankName = data.bank_name as string;
  if (data.account_number !== undefined) result.accountNumber = data.account_number as string;
  if (data.notes !== undefined) result.notes = data.notes as string;
  if (data.itemName !== undefined) result.itemName = data.itemName as string;
  if (data.item_name !== undefined) result.itemName = data.item_name as string;
  if (data.materialAmount !== undefined) result.materialAmount = data.materialAmount as number;
  if (data.laborAmount !== undefined) result.laborAmount = data.laborAmount as number;
  if (data.originalMaterialAmount !== undefined) result.originalMaterialAmount = data.originalMaterialAmount as number;
  if (data.originalLaborAmount !== undefined) result.originalLaborAmount = data.originalLaborAmount as number;
  if (data.applyTaxDeduction !== undefined) result.applyTaxDeduction = data.applyTaxDeduction as boolean;
  if (data.includesVAT !== undefined) result.includesVAT = data.includesVAT as boolean;
  if (data.quickText !== undefined) result.quickText = data.quickText as string;
  if (data.images !== undefined) {
    result.images = Array.isArray(data.images) ? data.images : [];
  }
  if (data.status !== undefined) result.status = data.status as FirestorePayment['status'];

  return result;
}

const paymentFirestoreService = {
  // 모든 결제요청 조회
  getAllPayments: async (): Promise<PaymentResponse[]> => {
    await loadProjectsCache();

    const collectionRef = collection(db, COLLECTIONS.PAYMENTS);
    const q = query(collectionRef, orderBy('id', 'desc'));
    const querySnapshot = await getDocs(q);

    return querySnapshot.docs.map(doc => {
      const data = doc.data() as FirestorePayment;
      return convertToPaymentResponse({ ...data, id: parseInt(doc.id) || data.id });
    });
  },

  // 단일 결제요청 조회
  getPaymentById: async (id: string): Promise<PaymentResponse | null> => {
    await loadProjectsCache();

    const docRef = doc(db, COLLECTIONS.PAYMENTS, id);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      const data = docSnap.data() as FirestorePayment;
      return convertToPaymentResponse({ ...data, id: parseInt(docSnap.id) || data.id });
    }
    return null;
  },

  // 결제요청 생성
  createPayment: async (data: Record<string, unknown>): Promise<PaymentResponse> => {
    await loadProjectsCache();

    // 새 문서 ID 생성 (현재 최대 ID + 1)
    const collectionRef = collection(db, COLLECTIONS.PAYMENTS);
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

    const newPayment: FirestorePayment = {
      id: newId,
      projectId: firestoreData.projectId || 0,
      userId: 1, // 기본 사용자
      requestType: firestoreData.requestType || 'material',
      vendorName: firestoreData.vendorName || '',
      description: firestoreData.description || '',
      amount: firestoreData.amount || 0,
      accountHolder: firestoreData.accountHolder || '',
      bankName: firestoreData.bankName || '',
      accountNumber: firestoreData.accountNumber || '',
      status: 'pending',
      approvedBy: null,
      paidAt: null,
      receiptUrl: null,
      notes: firestoreData.notes || '',
      createdAt: now,
      updatedAt: now,
      applyTaxDeduction: firestoreData.applyTaxDeduction || false,
      materialAmount: firestoreData.materialAmount || firestoreData.amount || 0,
      laborAmount: firestoreData.laborAmount || 0,
      originalMaterialAmount: firestoreData.originalMaterialAmount || 0,
      originalLaborAmount: firestoreData.originalLaborAmount || 0,
      itemName: firestoreData.itemName || '',
      includesVAT: firestoreData.includesVAT || false,
      quickText: firestoreData.quickText || '',
      images: firestoreData.images || [],
      imageCount: firestoreData.images?.length || 0
    };

    const docRef = doc(db, COLLECTIONS.PAYMENTS, String(newId));
    await setDoc(docRef, newPayment);

    return convertToPaymentResponse(newPayment);
  },

  // 결제요청 수정
  updatePayment: async (id: string, data: Record<string, unknown>): Promise<PaymentResponse> => {
    await loadProjectsCache();

    const docRef = doc(db, COLLECTIONS.PAYMENTS, id);
    const firestoreData = convertToFirestoreFormat(data);

    await updateDoc(docRef, {
      ...firestoreData,
      updatedAt: new Date().toISOString()
    });

    // 업데이트된 데이터 반환
    const updated = await paymentFirestoreService.getPaymentById(id);
    if (!updated) {
      throw new Error('Payment not found after update');
    }
    return updated;
  },

  // 결제요청 상태 변경
  updatePaymentStatus: async (id: string, status: string): Promise<PaymentResponse> => {
    await loadProjectsCache();

    const docRef = doc(db, COLLECTIONS.PAYMENTS, id);
    const now = new Date().toISOString();

    const updateData: Record<string, unknown> = {
      status,
      updatedAt: now
    };

    if (status === 'completed') {
      updateData.paidAt = now;
    }

    await updateDoc(docRef, updateData);

    const updated = await paymentFirestoreService.getPaymentById(id);
    if (!updated) {
      throw new Error('Payment not found after update');
    }
    return updated;
  },

  // 결제요청 금액 변경 (금액 분할)
  updatePaymentAmounts: async (id: string, materialAmount: number, laborAmount: number): Promise<PaymentResponse> => {
    await loadProjectsCache();

    const docRef = doc(db, COLLECTIONS.PAYMENTS, id);

    await updateDoc(docRef, {
      materialAmount,
      laborAmount,
      updatedAt: new Date().toISOString()
    });

    const updated = await paymentFirestoreService.getPaymentById(id);
    if (!updated) {
      throw new Error('Payment not found after update');
    }
    return updated;
  },

  // 결제요청 이미지 업데이트
  updatePaymentImages: async (id: string, images: string[]): Promise<{ message: string; images: string[] }> => {
    const docRef = doc(db, COLLECTIONS.PAYMENTS, id);

    await updateDoc(docRef, {
      images,
      imageCount: images.length,
      updatedAt: new Date().toISOString()
    });

    return { message: 'Images updated successfully', images };
  },

  // 결제요청 삭제
  deletePayment: async (id: string): Promise<void> => {
    const docRef = doc(db, COLLECTIONS.PAYMENTS, id);
    await deleteDoc(docRef);
  },

  // 실시간 결제요청 목록 구독
  subscribeToPayments: (callback: (payments: PaymentResponse[]) => void): Unsubscribe => {
    loadProjectsCache();

    const collectionRef = collection(db, COLLECTIONS.PAYMENTS);
    const q = query(collectionRef, orderBy('id', 'desc'));

    return onSnapshot(q, (snapshot) => {
      const payments = snapshot.docs.map(doc => {
        const data = doc.data() as FirestorePayment;
        return convertToPaymentResponse({ ...data, id: parseInt(doc.id) || data.id });
      });
      callback(payments);
    });
  },

  // 프로젝트별 결제요청 조회
  getPaymentsByProject: async (projectId: number): Promise<PaymentResponse[]> => {
    await loadProjectsCache();

    const collectionRef = collection(db, COLLECTIONS.PAYMENTS);
    const q = query(
      collectionRef,
      where('projectId', '==', projectId),
      orderBy('id', 'desc')
    );
    const querySnapshot = await getDocs(q);

    return querySnapshot.docs.map(doc => {
      const data = doc.data() as FirestorePayment;
      return convertToPaymentResponse({ ...data, id: parseInt(doc.id) || data.id });
    });
  },

  // 프로젝트 캐시 초기화 (프로젝트 변경 시 호출)
  clearProjectsCache: (): void => {
    projectsCache.clear();
  }
};

export default paymentFirestoreService;
