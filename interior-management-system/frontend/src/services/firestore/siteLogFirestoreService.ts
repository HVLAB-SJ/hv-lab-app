/**
 * Site Log Firestore Service
 * 현장일지 데이터를 Firestore에서 직접 관리
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
  where,
  Timestamp
} from 'firebase/firestore';

const COLLECTION_NAME = 'site_logs';

interface SiteLogData {
  project: string;
  date: Date | string;
  images: string[];
  notes?: string;
  createdBy: string;
}

interface SiteLogResponse {
  _id: string;
  project: string;
  date: string;
  images: string[];
  notes?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

// Firestore 문서를 SiteLogResponse 형식으로 변환
const convertDoc = (docSnap: any): SiteLogResponse => {
  const data = docSnap.data();
  return {
    _id: docSnap.id,
    project: data.project || '',
    date: data.date instanceof Timestamp
      ? data.date.toDate().toISOString()
      : data.date || '',
    images: data.images || [],
    notes: data.notes || '',
    createdBy: data.createdBy || '',
    createdAt: data.createdAt instanceof Timestamp
      ? data.createdAt.toDate().toISOString()
      : data.createdAt || '',
    updatedAt: data.updatedAt instanceof Timestamp
      ? data.updatedAt.toDate().toISOString()
      : data.updatedAt || ''
  };
};

const siteLogFirestoreService = {
  // 모든 일지 조회
  getAllLogs: async (): Promise<SiteLogResponse[]> => {
    const q = query(collection(db, COLLECTION_NAME), orderBy('date', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(convertDoc);
  },

  // 프로젝트별 일지 조회
  getProjectLogs: async (projectName: string): Promise<SiteLogResponse[]> => {
    const q = query(
      collection(db, COLLECTION_NAME),
      where('project', '==', projectName),
      orderBy('date', 'desc')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(convertDoc);
  },

  // 일지 생성
  createLog: async (logData: SiteLogData): Promise<SiteLogResponse> => {
    const now = Timestamp.now();
    const newData = {
      project: logData.project,
      date: logData.date instanceof Date
        ? Timestamp.fromDate(logData.date)
        : logData.date,
      images: logData.images || [],
      notes: logData.notes || '',
      createdBy: logData.createdBy,
      createdAt: now,
      updatedAt: now
    };

    const docRef = await addDoc(collection(db, COLLECTION_NAME), newData);
    const created = await getDoc(docRef);
    return convertDoc(created);
  },

  // 일지 수정
  updateLog: async (id: string, logData: Partial<SiteLogData>): Promise<SiteLogResponse> => {
    const docRef = doc(db, COLLECTION_NAME, id);
    const updateData: Record<string, any> = {
      updatedAt: Timestamp.now()
    };

    if (logData.project !== undefined) updateData.project = logData.project;
    if (logData.date !== undefined) {
      updateData.date = logData.date instanceof Date
        ? Timestamp.fromDate(logData.date)
        : logData.date;
    }
    if (logData.images !== undefined) updateData.images = logData.images;
    if (logData.notes !== undefined) updateData.notes = logData.notes;

    await updateDoc(docRef, updateData);
    const updated = await getDoc(docRef);
    return convertDoc(updated);
  },

  // 일지 삭제
  deleteLog: async (id: string): Promise<void> => {
    const docRef = doc(db, COLLECTION_NAME, id);
    await deleteDoc(docRef);
  },

  // 날짜 범위로 조회
  getLogsByDateRange: async (projectName: string, startDate: Date, endDate: Date): Promise<SiteLogResponse[]> => {
    const q = query(
      collection(db, COLLECTION_NAME),
      where('project', '==', projectName),
      where('date', '>=', Timestamp.fromDate(startDate)),
      where('date', '<=', Timestamp.fromDate(endDate)),
      orderBy('date', 'desc')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(convertDoc);
  },

  // 실시간 구독
  subscribeToLogs: (callback: (logs: SiteLogResponse[]) => void) => {
    const q = query(collection(db, COLLECTION_NAME), orderBy('date', 'desc'));
    return onSnapshot(q, (snapshot) => {
      const logs = snapshot.docs.map(convertDoc);
      callback(logs);
    });
  }
};

export default siteLogFirestoreService;
