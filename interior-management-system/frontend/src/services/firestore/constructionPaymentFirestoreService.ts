/**
 * Construction Payment Firestore Service
 * 공사금 데이터를 Firestore에서 직접 관리
 */

import { db } from '../../config/firebase';
import {
  collection,
  doc,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  Timestamp
} from 'firebase/firestore';
import type { ConstructionPaymentResponse, ConstructionPaymentData } from '../constructionPaymentService';

const COLLECTION_NAME = 'construction_payments';

// Firestore 문서를 ConstructionPaymentResponse 형식으로 변환
const convertDoc = (docSnap: any): ConstructionPaymentResponse => {
  const data = docSnap.data();

  // payments 배열 변환 (문자열인 경우 파싱)
  let paymentsArray = data.payments || [];
  if (typeof paymentsArray === 'string') {
    try {
      paymentsArray = JSON.parse(paymentsArray);
    } catch {
      paymentsArray = [];
    }
  }
  if (!Array.isArray(paymentsArray)) {
    paymentsArray = [];
  }

  const payments = paymentsArray.map((p: any) => {
    // types 필드 변환 (문자열인 경우 파싱)
    let typesArray = p.types || [];
    if (typeof typesArray === 'string') {
      try {
        typesArray = JSON.parse(typesArray);
      } catch {
        typesArray = [typesArray]; // 단일 문자열인 경우 배열로 변환
      }
    }
    if (!Array.isArray(typesArray)) {
      typesArray = [];
    }

    return {
      types: typesArray,
      type: typesArray[0] || p.type || '계약금', // type 필드도 추가
      amount: p.amount || 0,
      date: p.date instanceof Timestamp
        ? p.date.toDate().toISOString()
        : p.date || '',
      method: p.method || '',
      notes: p.notes || ''
    };
  });

  // expectedPaymentDates 변환
  const expectedPaymentDates: any = {};
  if (data.expectedPaymentDates) {
    if (data.expectedPaymentDates.contract) {
      expectedPaymentDates.contract = data.expectedPaymentDates.contract instanceof Timestamp
        ? data.expectedPaymentDates.contract.toDate().toISOString()
        : data.expectedPaymentDates.contract;
    }
    if (data.expectedPaymentDates.start) {
      expectedPaymentDates.start = data.expectedPaymentDates.start instanceof Timestamp
        ? data.expectedPaymentDates.start.toDate().toISOString()
        : data.expectedPaymentDates.start;
    }
    if (data.expectedPaymentDates.middle) {
      expectedPaymentDates.middle = data.expectedPaymentDates.middle instanceof Timestamp
        ? data.expectedPaymentDates.middle.toDate().toISOString()
        : data.expectedPaymentDates.middle;
    }
    if (data.expectedPaymentDates.final) {
      expectedPaymentDates.final = data.expectedPaymentDates.final instanceof Timestamp
        ? data.expectedPaymentDates.final.toDate().toISOString()
        : data.expectedPaymentDates.final;
    }
  }

  return {
    _id: docSnap.id,
    project: data.project || '',
    client: data.client || '',
    totalAmount: data.totalAmount || 0,
    vatType: data.vatType || 'percentage',
    vatPercentage: data.vatPercentage || 0,
    vatAmount: data.vatAmount || 0,
    payments,
    expectedPaymentDates,
    createdAt: data.createdAt instanceof Timestamp
      ? data.createdAt.toDate().toISOString()
      : data.createdAt || '',
    updatedAt: data.updatedAt instanceof Timestamp
      ? data.updatedAt.toDate().toISOString()
      : data.updatedAt || ''
  };
};

const constructionPaymentFirestoreService = {
  // 모든 공사금 조회
  getAllConstructionPayments: async (): Promise<ConstructionPaymentResponse[]> => {
    console.log('[ConstructionPayment] Firestore 조회 시작...');
    try {
      // createdAt이 없는 문서가 있을 수 있으므로 정렬 없이 조회
      const snapshot = await getDocs(collection(db, COLLECTION_NAME));
      console.log('[ConstructionPayment] Firestore 스냅샷:', snapshot.size, '개 문서');
      const results = snapshot.docs
        .map(convertDoc)
        .filter(doc => doc.project && doc.totalAmount); // undefined 필터링
      console.log('[ConstructionPayment] Firestore에서 로드 완료:', results.length, '개');
      return results;
    } catch (error) {
      console.error('[ConstructionPayment] Firestore 조회 실패:', error);
      return [];
    }
  },

  // 단일 공사금 조회
  getConstructionPaymentById: async (id: string): Promise<ConstructionPaymentResponse | null> => {
    const docRef = doc(db, COLLECTION_NAME, id);
    const docSnap = await getDoc(docRef);
    if (!docSnap.exists()) return null;
    return convertDoc(docSnap);
  },

  // 공사금 생성
  createConstructionPayment: async (data: ConstructionPaymentData): Promise<ConstructionPaymentResponse> => {
    const now = Timestamp.now();

    // payments 배열 변환
    const payments = (data.payments || []).map((p) => ({
      types: p.types,
      amount: p.amount,
      date: p.date instanceof Date ? Timestamp.fromDate(p.date) : p.date,
      method: p.method,
      notes: p.notes || ''
    }));

    // expectedPaymentDates 변환
    const expectedPaymentDates: any = {};
    if (data.expectedPaymentDates) {
      if (data.expectedPaymentDates.contract) {
        expectedPaymentDates.contract = data.expectedPaymentDates.contract instanceof Date
          ? Timestamp.fromDate(data.expectedPaymentDates.contract)
          : data.expectedPaymentDates.contract;
      }
      if (data.expectedPaymentDates.start) {
        expectedPaymentDates.start = data.expectedPaymentDates.start instanceof Date
          ? Timestamp.fromDate(data.expectedPaymentDates.start)
          : data.expectedPaymentDates.start;
      }
      if (data.expectedPaymentDates.middle) {
        expectedPaymentDates.middle = data.expectedPaymentDates.middle instanceof Date
          ? Timestamp.fromDate(data.expectedPaymentDates.middle)
          : data.expectedPaymentDates.middle;
      }
      if (data.expectedPaymentDates.final) {
        expectedPaymentDates.final = data.expectedPaymentDates.final instanceof Date
          ? Timestamp.fromDate(data.expectedPaymentDates.final)
          : data.expectedPaymentDates.final;
      }
    }

    const newData = {
      project: data.project,
      client: data.client,
      totalAmount: data.totalAmount,
      vatType: data.vatType,
      vatPercentage: data.vatPercentage,
      vatAmount: data.vatAmount,
      payments,
      expectedPaymentDates,
      createdAt: now,
      updatedAt: now
    };

    const docRef = await addDoc(collection(db, COLLECTION_NAME), newData);
    const created = await getDoc(docRef);
    return convertDoc(created);
  },

  // 공사금 수정
  updateConstructionPayment: async (id: string, data: Partial<ConstructionPaymentData>): Promise<ConstructionPaymentResponse> => {
    const docRef = doc(db, COLLECTION_NAME, id);
    const updateData: Record<string, any> = {
      updatedAt: Timestamp.now()
    };

    if (data.project !== undefined) updateData.project = data.project;
    if (data.client !== undefined) updateData.client = data.client;
    if (data.totalAmount !== undefined) updateData.totalAmount = data.totalAmount;
    if (data.vatType !== undefined) updateData.vatType = data.vatType;
    if (data.vatPercentage !== undefined) updateData.vatPercentage = data.vatPercentage;
    if (data.vatAmount !== undefined) updateData.vatAmount = data.vatAmount;

    if (data.payments !== undefined) {
      updateData.payments = data.payments.map((p) => ({
        types: p.types,
        amount: p.amount,
        date: p.date instanceof Date ? Timestamp.fromDate(p.date) : p.date,
        method: p.method,
        notes: p.notes || ''
      }));
    }

    if (data.expectedPaymentDates !== undefined) {
      const expectedPaymentDates: any = {};
      if (data.expectedPaymentDates.contract) {
        expectedPaymentDates.contract = data.expectedPaymentDates.contract instanceof Date
          ? Timestamp.fromDate(data.expectedPaymentDates.contract)
          : data.expectedPaymentDates.contract;
      }
      if (data.expectedPaymentDates.start) {
        expectedPaymentDates.start = data.expectedPaymentDates.start instanceof Date
          ? Timestamp.fromDate(data.expectedPaymentDates.start)
          : data.expectedPaymentDates.start;
      }
      if (data.expectedPaymentDates.middle) {
        expectedPaymentDates.middle = data.expectedPaymentDates.middle instanceof Date
          ? Timestamp.fromDate(data.expectedPaymentDates.middle)
          : data.expectedPaymentDates.middle;
      }
      if (data.expectedPaymentDates.final) {
        expectedPaymentDates.final = data.expectedPaymentDates.final instanceof Date
          ? Timestamp.fromDate(data.expectedPaymentDates.final)
          : data.expectedPaymentDates.final;
      }
      updateData.expectedPaymentDates = expectedPaymentDates;
    }

    await updateDoc(docRef, updateData);
    const updated = await getDoc(docRef);
    return convertDoc(updated);
  },

  // 공사금 삭제
  deleteConstructionPayment: async (id: string): Promise<void> => {
    const docRef = doc(db, COLLECTION_NAME, id);
    await deleteDoc(docRef);
  },

  // 실시간 구독
  subscribeToConstructionPayments: (callback: (payments: ConstructionPaymentResponse[]) => void) => {
    const q = query(collection(db, COLLECTION_NAME), orderBy('createdAt', 'desc'));
    return onSnapshot(q, (snapshot) => {
      const payments = snapshot.docs.map(convertDoc);
      callback(payments);
    });
  }
};

export default constructionPaymentFirestoreService;
