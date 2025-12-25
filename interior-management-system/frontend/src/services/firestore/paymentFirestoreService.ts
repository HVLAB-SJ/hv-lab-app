/**
 * 결제요청 Firestore 서비스
 */
import { db } from '../../config/firebase';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  getDocsFromServer,
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
import { uploadImagesToStorage, deleteImagesFromStorage, isBase64Image } from './storageService';

// Firestore 결제요청 타입
export interface FirestorePayment {
  id: number;
  projectId: number;
  userId: number;
  requestedBy: string; // 요청자 이름
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
  requestDate: string; // 요청 날짜 (사용자가 선택한 날짜)
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
  request_date?: string; // 사용자가 선택한 요청 날짜
}

// 프로젝트 정보 캐시
let projectsCache: Map<string, { name: string; color: string }> = new Map();
let projectsCachePromise: Promise<void> | null = null;

async function loadProjectsCache(): Promise<void> {
  // 이미 로드 완료된 경우
  if (projectsCache.size > 0) return;

  // 이미 로드 중인 경우 기존 Promise를 기다림
  if (projectsCachePromise) {
    return projectsCachePromise;
  }

  // 새로 로드 시작
  projectsCachePromise = (async () => {
    try {
      const projectsRef = collection(db, COLLECTIONS.PROJECTS);
      const querySnapshot = await getDocs(projectsRef);

      querySnapshot.docs.forEach(doc => {
        const data = doc.data();
        projectsCache.set(doc.id, {
          name: data.name || '',
          color: data.color || '#4A90E2'
        });
      });
      console.log('[paymentFirestoreService] 프로젝트 캐시 로드 완료:', projectsCache.size, '개');
    } catch (error) {
      console.error('[paymentFirestoreService] 프로젝트 캐시 로드 실패:', error);
      projectsCachePromise = null; // 실패 시 다시 시도할 수 있도록
      throw error;
    }
  })();

  return projectsCachePromise;
}

// Firestore 데이터를 API 응답 형식으로 변환
function convertToPaymentResponse(firestoreData: FirestorePayment): PaymentResponse {
  const project = projectsCache.get(String(firestoreData.projectId)) || { name: '', color: '#4A90E2' };

  // 디버깅: 프로젝트명이 비어있는 경우 로그
  if (!project.name && firestoreData.status === 'pending') {
    console.warn('[convertToPaymentResponse] 프로젝트명 없음!', {
      paymentId: firestoreData.id,
      projectId: firestoreData.projectId,
      cacheSize: projectsCache.size,
      cacheKeys: Array.from(projectsCache.keys()).slice(0, 5),
      vendorName: firestoreData.vendorName
    });
  }

  return {
    id: firestoreData.id,
    project_id: firestoreData.projectId,
    project_name: project.name,
    project_color: project.color,
    user_id: firestoreData.userId || 0,
    requester_name: firestoreData.requestedBy || '', // 요청자 이름
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
    paid_at: firestoreData.paidAt || undefined,
    request_date: firestoreData.requestDate || firestoreData.createdAt || '' // 요청 날짜 (없으면 생성일 사용)
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
  // bankInfo 객체에서 계좌정보 추출
  if (data.bankInfo !== undefined && typeof data.bankInfo === 'object' && data.bankInfo !== null) {
    const bankInfo = data.bankInfo as { accountHolder?: string; bankName?: string; accountNumber?: string };
    if (bankInfo.accountHolder) result.accountHolder = bankInfo.accountHolder;
    if (bankInfo.bankName) result.bankName = bankInfo.bankName;
    if (bankInfo.accountNumber) result.accountNumber = bankInfo.accountNumber;
  }
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
  if (data.requestedBy !== undefined) result.requestedBy = data.requestedBy as string;

  // 요청 날짜 처리 (Date 객체 또는 문자열)
  if (data.requestDate !== undefined) {
    const rd = data.requestDate;
    if (rd instanceof Date) {
      result.requestDate = rd.toISOString();
    } else if (typeof rd === 'string') {
      result.requestDate = rd;
    }
  }
  if (data.request_date !== undefined && typeof data.request_date === 'string') {
    result.requestDate = data.request_date;
  }

  return result;
}

const paymentFirestoreService = {
  // 모든 결제요청 조회 (서버에서 직접 가져오기 - 캐시 우회)
  getAllPayments: async (): Promise<PaymentResponse[]> => {
    await loadProjectsCache();

    const collectionRef = collection(db, COLLECTIONS.PAYMENTS);
    const q = query(collectionRef, orderBy('id', 'desc'));

    let querySnapshot;
    try {
      // 서버에서 직접 가져오기 (캐시 우회)
      querySnapshot = await getDocsFromServer(q);
      console.log('[getAllPayments] 서버에서 직접 가져옴:', querySnapshot.docs.length, '건');
    } catch (error) {
      // 네트워크 오류 시 캐시에서 가져오기
      console.warn('[getAllPayments] 서버 연결 실패, 캐시 사용:', error);
      querySnapshot = await getDocs(q);
    }

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
      requestedBy: firestoreData.requestedBy || '', // 요청자 이름
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
      requestDate: firestoreData.requestDate || now, // 사용자가 선택한 요청 날짜
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
      images: [],
      imageCount: 0
    };

    const docRef = doc(db, COLLECTIONS.PAYMENTS, String(newId));
    await setDoc(docRef, newPayment);

    // Base64 이미지를 Storage로 업로드
    if (firestoreData.images && firestoreData.images.length > 0) {
      const hasBase64 = firestoreData.images.some(img => isBase64Image(img));
      if (hasBase64) {
        const imageUrls = await uploadImagesToStorage('payments', String(newId), firestoreData.images);
        await updateDoc(docRef, { images: imageUrls, imageCount: imageUrls.length });
        newPayment.images = imageUrls;
        newPayment.imageCount = imageUrls.length;
      } else {
        await updateDoc(docRef, { images: firestoreData.images, imageCount: firestoreData.images.length });
        newPayment.images = firestoreData.images;
        newPayment.imageCount = firestoreData.images.length;
      }
    }

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
    console.log('[Firestore] 상태 변경 시작:', id, '->', status);
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
    console.log('[Firestore] 상태 변경 완료:', id, '->', status);

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

    // Base64 이미지를 Storage로 업로드
    let imageUrls = images;
    if (images.length > 0) {
      const hasBase64 = images.some(img => isBase64Image(img));
      if (hasBase64) {
        imageUrls = await uploadImagesToStorage('payments', id, images);
      }
    }

    await updateDoc(docRef, {
      images: imageUrls,
      imageCount: imageUrls.length,
      updatedAt: new Date().toISOString()
    });

    return { message: 'Images updated successfully', images: imageUrls };
  },

  // 결제요청 삭제
  deletePayment: async (id: string): Promise<void> => {
    const docRef = doc(db, COLLECTIONS.PAYMENTS, id);

    // 기존 이미지 삭제
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      const data = docSnap.data() as FirestorePayment;
      if (data.images && data.images.length > 0) {
        await deleteImagesFromStorage(data.images);
      }
    }

    await deleteDoc(docRef);
  },

  // 실시간 결제요청 목록 구독
  subscribeToPayments: (callback: (payments: PaymentResponse[]) => void): Unsubscribe => {
    console.log('[paymentFirestoreService] subscribeToPayments 호출됨');

    // 먼저 프로젝트 캐시를 로드한 후 구독 시작
    let unsubscribe: Unsubscribe | null = null;

    // 프로젝트 캐시 로드 후 구독 설정
    loadProjectsCache().then(() => {
      const collectionRef = collection(db, COLLECTIONS.PAYMENTS);
      const q = query(collectionRef, orderBy('id', 'desc'));

      console.log('[paymentFirestoreService] Firestore onSnapshot 구독 시작...');

      unsubscribe = onSnapshot(
        q,
        { includeMetadataChanges: true },
        (snapshot) => {
          console.log('[실시간 구독] 스냅샷 수신:', snapshot.docs.length, '건, fromCache:', snapshot.metadata.fromCache);

          // 변경된 문서 로그
          snapshot.docChanges().forEach(change => {
            const data = change.doc.data();
            console.log(`[실시간 구독] 변경: ${change.type} - ID: ${change.doc.id}, status: ${data.status}`);
          });

          const payments = snapshot.docs.map(doc => {
            const data = doc.data() as FirestorePayment;
            return convertToPaymentResponse({ ...data, id: parseInt(doc.id) || data.id });
          });
          callback(payments);
        },
        (error) => {
          console.error('[실시간 구독] 오류 발생:', error);
        }
      );
    }).catch(error => {
      console.error('[paymentFirestoreService] 프로젝트 캐시 로드 실패:', error);
    });

    // 구독 해제 함수 반환
    return () => {
      console.log('[paymentFirestoreService] 구독 해제 요청됨');
      if (unsubscribe) {
        unsubscribe();
      }
    };
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
    projectsCachePromise = null;
  }
};

export default paymentFirestoreService;
