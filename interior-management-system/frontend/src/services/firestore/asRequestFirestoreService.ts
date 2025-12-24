/**
 * AS Request Firestore Service
 * AS요청 데이터를 Firestore에서 직접 관리
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
import type { ASRequestResponse, ASRequestData } from '../asRequestService';

const COLLECTION_NAME = 'as_requests';

// Firestore 문서를 ASRequestResponse 형식으로 변환
const convertDoc = (docSnap: any): ASRequestResponse => {
  const data = docSnap.data();
  return {
    _id: docSnap.id,
    project: data.project || '',
    client: data.client || '',
    requestDate: data.requestDate instanceof Timestamp
      ? data.requestDate.toDate().toISOString()
      : data.requestDate || '',
    siteAddress: data.siteAddress || '',
    entrancePassword: data.entrancePassword || '',
    description: data.description || '',
    scheduledVisitDate: data.scheduledVisitDate instanceof Timestamp
      ? data.scheduledVisitDate.toDate().toISOString()
      : data.scheduledVisitDate,
    scheduledVisitTime: data.scheduledVisitTime || '',
    assignedTo: data.assignedTo || '',
    completionDate: data.completionDate instanceof Timestamp
      ? data.completionDate.toDate().toISOString()
      : data.completionDate,
    notes: data.notes || '',
    status: data.status || 'pending',
    createdAt: data.createdAt instanceof Timestamp
      ? data.createdAt.toDate().toISOString()
      : data.createdAt || '',
    updatedAt: data.updatedAt instanceof Timestamp
      ? data.updatedAt.toDate().toISOString()
      : data.updatedAt || ''
  };
};

const asRequestFirestoreService = {
  // 모든 AS요청 조회
  getAllASRequests: async (): Promise<ASRequestResponse[]> => {
    const q = query(collection(db, COLLECTION_NAME), orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(convertDoc);
  },

  // 단일 AS요청 조회
  getASRequestById: async (id: string): Promise<ASRequestResponse | null> => {
    const docRef = doc(db, COLLECTION_NAME, id);
    const docSnap = await getDoc(docRef);
    if (!docSnap.exists()) return null;
    return convertDoc(docSnap);
  },

  // AS요청 생성
  createASRequest: async (data: ASRequestData): Promise<ASRequestResponse> => {
    const now = Timestamp.now();
    const newData: Record<string, any> = {
      project: data.project,
      client: data.client,
      requestDate: data.requestDate instanceof Date
        ? Timestamp.fromDate(data.requestDate)
        : data.requestDate,
      siteAddress: data.siteAddress,
      entrancePassword: data.entrancePassword,
      description: data.description,
      status: data.status || 'pending',
      notes: data.notes || '',
      createdAt: now,
      updatedAt: now
    };

    if (data.scheduledVisitDate) {
      newData.scheduledVisitDate = data.scheduledVisitDate instanceof Date
        ? Timestamp.fromDate(data.scheduledVisitDate)
        : data.scheduledVisitDate;
    }
    if (data.scheduledVisitTime) newData.scheduledVisitTime = data.scheduledVisitTime;
    if (data.assignedTo) newData.assignedTo = data.assignedTo;

    const docRef = await addDoc(collection(db, COLLECTION_NAME), newData);
    const created = await getDoc(docRef);
    return convertDoc(created);
  },

  // AS요청 수정
  updateASRequest: async (id: string, data: Partial<ASRequestData>): Promise<ASRequestResponse> => {
    const docRef = doc(db, COLLECTION_NAME, id);
    const updateData: Record<string, any> = {
      updatedAt: Timestamp.now()
    };

    if (data.project !== undefined) updateData.project = data.project;
    if (data.client !== undefined) updateData.client = data.client;
    if (data.requestDate !== undefined) {
      updateData.requestDate = data.requestDate instanceof Date
        ? Timestamp.fromDate(data.requestDate)
        : data.requestDate;
    }
    if (data.siteAddress !== undefined) updateData.siteAddress = data.siteAddress;
    if (data.entrancePassword !== undefined) updateData.entrancePassword = data.entrancePassword;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.scheduledVisitDate !== undefined) {
      updateData.scheduledVisitDate = data.scheduledVisitDate instanceof Date
        ? Timestamp.fromDate(data.scheduledVisitDate)
        : data.scheduledVisitDate;
    }
    if (data.scheduledVisitTime !== undefined) updateData.scheduledVisitTime = data.scheduledVisitTime;
    if (data.assignedTo !== undefined) updateData.assignedTo = data.assignedTo;
    if (data.completionDate !== undefined) {
      updateData.completionDate = data.completionDate instanceof Date
        ? Timestamp.fromDate(data.completionDate)
        : data.completionDate;
    }
    if (data.notes !== undefined) updateData.notes = data.notes;
    if (data.status !== undefined) updateData.status = data.status;

    await updateDoc(docRef, updateData);
    const updated = await getDoc(docRef);
    return convertDoc(updated);
  },

  // AS요청 삭제
  deleteASRequest: async (id: string): Promise<void> => {
    const docRef = doc(db, COLLECTION_NAME, id);
    await deleteDoc(docRef);
  },

  // 실시간 구독
  subscribeToASRequests: (callback: (requests: ASRequestResponse[]) => void) => {
    const q = query(collection(db, COLLECTION_NAME), orderBy('createdAt', 'desc'));
    return onSnapshot(q, (snapshot) => {
      const requests = snapshot.docs.map(convertDoc);
      callback(requests);
    });
  }
};

export default asRequestFirestoreService;
