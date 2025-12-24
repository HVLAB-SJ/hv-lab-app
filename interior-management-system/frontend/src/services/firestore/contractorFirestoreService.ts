/**
 * Contractor Firestore Service
 * 협력업체 데이터를 Firestore에서 직접 관리
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
import type { ContractorResponse, ContractorData } from '../contractorService';

const COLLECTION_NAME = 'contractors';

// Firestore 문서를 ContractorResponse 형식으로 변환
const convertDoc = (docSnap: any): ContractorResponse => {
  const data = docSnap.data();
  return {
    _id: docSnap.id,
    rank: data.rank || '',
    companyName: data.companyName || '',
    name: data.name || '',
    position: data.position || '',
    process: data.process || '',
    contact: data.contact || '',
    accountNumber: data.accountNumber || '',
    notes: data.notes || '',
    createdAt: data.createdAt instanceof Timestamp
      ? data.createdAt.toDate().toISOString()
      : data.createdAt || '',
    updatedAt: data.updatedAt instanceof Timestamp
      ? data.updatedAt.toDate().toISOString()
      : data.updatedAt || ''
  };
};

const contractorFirestoreService = {
  // 모든 협력업체 조회
  getAllContractors: async (): Promise<ContractorResponse[]> => {
    const q = query(collection(db, COLLECTION_NAME), orderBy('name', 'asc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(convertDoc);
  },

  // 단일 협력업체 조회
  getContractorById: async (id: string): Promise<ContractorResponse | null> => {
    const docRef = doc(db, COLLECTION_NAME, id);
    const docSnap = await getDoc(docRef);
    if (!docSnap.exists()) return null;
    return convertDoc(docSnap);
  },

  // 협력업체 생성
  createContractor: async (data: ContractorData): Promise<ContractorResponse> => {
    const now = Timestamp.now();
    const newData = {
      rank: data.rank || '',
      companyName: data.companyName || '',
      name: data.name,
      position: data.position || '',
      process: data.process,
      contact: data.contact || '',
      accountNumber: data.accountNumber,
      notes: data.notes || '',
      createdAt: now,
      updatedAt: now
    };

    const docRef = await addDoc(collection(db, COLLECTION_NAME), newData);
    const created = await getDoc(docRef);
    return convertDoc(created);
  },

  // 협력업체 수정
  updateContractor: async (id: string, data: Partial<ContractorData>): Promise<ContractorResponse> => {
    const docRef = doc(db, COLLECTION_NAME, id);
    const updateData: Record<string, any> = {
      updatedAt: Timestamp.now()
    };

    if (data.rank !== undefined) updateData.rank = data.rank;
    if (data.companyName !== undefined) updateData.companyName = data.companyName;
    if (data.name !== undefined) updateData.name = data.name;
    if (data.position !== undefined) updateData.position = data.position;
    if (data.process !== undefined) updateData.process = data.process;
    if (data.contact !== undefined) updateData.contact = data.contact;
    if (data.accountNumber !== undefined) updateData.accountNumber = data.accountNumber;
    if (data.notes !== undefined) updateData.notes = data.notes;

    await updateDoc(docRef, updateData);
    const updated = await getDoc(docRef);
    return convertDoc(updated);
  },

  // 협력업체 삭제
  deleteContractor: async (id: string): Promise<void> => {
    const docRef = doc(db, COLLECTION_NAME, id);
    await deleteDoc(docRef);
  },

  // 실시간 구독
  subscribeToContractors: (callback: (contractors: ContractorResponse[]) => void) => {
    const q = query(collection(db, COLLECTION_NAME), orderBy('name', 'asc'));
    return onSnapshot(q, (snapshot) => {
      const contractors = snapshot.docs.map(convertDoc);
      callback(contractors);
    });
  }
};

export default contractorFirestoreService;
