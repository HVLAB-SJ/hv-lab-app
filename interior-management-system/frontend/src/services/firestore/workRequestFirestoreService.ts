/**
 * Work Request Firestore Service
 * 작업요청 데이터를 Firestore에서 직접 관리
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
import type { WorkRequestResponse, WorkRequestData } from '../workRequestService';

const COLLECTION_NAME = 'work_requests';

// Firestore 문서를 WorkRequestResponse 형식으로 변환
const convertDoc = (docSnap: any): WorkRequestResponse => {
  const data = docSnap.data();
  return {
    _id: docSnap.id,
    project: data.project || '',
    requestType: data.requestType || '',
    description: data.description || '',
    requestDate: data.requestDate instanceof Timestamp
      ? data.requestDate.toDate().toISOString()
      : data.requestDate || '',
    dueDate: data.dueDate instanceof Timestamp
      ? data.dueDate.toDate().toISOString()
      : data.dueDate || '',
    requestedBy: data.requestedBy || '',
    assignedTo: data.assignedTo || '',
    status: data.status || 'pending',
    priority: data.priority || 'medium',
    notes: data.notes || '',
    completedDate: data.completedDate instanceof Timestamp
      ? data.completedDate.toDate().toISOString()
      : data.completedDate,
    createdAt: data.createdAt instanceof Timestamp
      ? data.createdAt.toDate().toISOString()
      : data.createdAt || '',
    updatedAt: data.updatedAt instanceof Timestamp
      ? data.updatedAt.toDate().toISOString()
      : data.updatedAt || ''
  };
};

const workRequestFirestoreService = {
  // 모든 작업요청 조회
  getAllWorkRequests: async (): Promise<WorkRequestResponse[]> => {
    const q = query(collection(db, COLLECTION_NAME), orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(convertDoc);
  },

  // 단일 작업요청 조회
  getWorkRequestById: async (id: string): Promise<WorkRequestResponse | null> => {
    const docRef = doc(db, COLLECTION_NAME, id);
    const docSnap = await getDoc(docRef);
    if (!docSnap.exists()) return null;
    return convertDoc(docSnap);
  },

  // 작업요청 생성
  createWorkRequest: async (data: WorkRequestData): Promise<WorkRequestResponse> => {
    const now = Timestamp.now();
    const newData = {
      project: data.project,
      requestType: data.requestType,
      description: data.description,
      requestDate: data.requestDate instanceof Date
        ? Timestamp.fromDate(data.requestDate)
        : data.requestDate,
      dueDate: data.dueDate instanceof Date
        ? Timestamp.fromDate(data.dueDate)
        : data.dueDate,
      requestedBy: data.requestedBy,
      assignedTo: data.assignedTo,
      status: data.status || 'pending',
      priority: data.priority || 'medium',
      notes: data.notes || '',
      createdAt: now,
      updatedAt: now
    };

    const docRef = await addDoc(collection(db, COLLECTION_NAME), newData);
    const created = await getDoc(docRef);
    return convertDoc(created);
  },

  // 작업요청 수정
  updateWorkRequest: async (id: string, data: Partial<WorkRequestData>): Promise<WorkRequestResponse> => {
    const docRef = doc(db, COLLECTION_NAME, id);
    const updateData: Record<string, any> = {
      updatedAt: Timestamp.now()
    };

    if (data.project !== undefined) updateData.project = data.project;
    if (data.requestType !== undefined) updateData.requestType = data.requestType;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.requestDate !== undefined) {
      updateData.requestDate = data.requestDate instanceof Date
        ? Timestamp.fromDate(data.requestDate)
        : data.requestDate;
    }
    if (data.dueDate !== undefined) {
      updateData.dueDate = data.dueDate instanceof Date
        ? Timestamp.fromDate(data.dueDate)
        : data.dueDate;
    }
    if (data.requestedBy !== undefined) updateData.requestedBy = data.requestedBy;
    if (data.assignedTo !== undefined) updateData.assignedTo = data.assignedTo;
    if (data.status !== undefined) updateData.status = data.status;
    if (data.priority !== undefined) updateData.priority = data.priority;
    if (data.notes !== undefined) updateData.notes = data.notes;
    if (data.completedDate !== undefined) {
      updateData.completedDate = data.completedDate instanceof Date
        ? Timestamp.fromDate(data.completedDate)
        : data.completedDate;
    }

    await updateDoc(docRef, updateData);
    const updated = await getDoc(docRef);
    return convertDoc(updated);
  },

  // 작업요청 삭제
  deleteWorkRequest: async (id: string): Promise<void> => {
    const docRef = doc(db, COLLECTION_NAME, id);
    await deleteDoc(docRef);
  },

  // 실시간 구독
  subscribeToWorkRequests: (callback: (requests: WorkRequestResponse[]) => void) => {
    const q = query(collection(db, COLLECTION_NAME), orderBy('createdAt', 'desc'));
    return onSnapshot(q, (snapshot) => {
      const requests = snapshot.docs.map(convertDoc);
      callback(requests);
    });
  }
};

export default workRequestFirestoreService;
