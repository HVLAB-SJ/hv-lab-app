/**
 * Firestore 서비스 - 공통 유틸리티
 */
import { db } from '../../config/firebase';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  QueryConstraint,
  DocumentData,
  Timestamp,
  onSnapshot,
  Unsubscribe
} from 'firebase/firestore';

// Firestore 컬렉션 이름
export const COLLECTIONS = {
  PROJECTS: 'projects',
  PAYMENTS: 'payment_requests',
  SCHEDULES: 'schedules',
  CONTRACTORS: 'contractors',
  EXECUTION_RECORDS: 'execution_records',
  AS_REQUESTS: 'as_requests',
  ADDITIONAL_WORKS: 'additional_works',
  CONSTRUCTION_PAYMENTS: 'construction_payments',
  SITE_LOGS: 'site_logs',
  DRAWINGS: 'drawings',
  WORK_REQUESTS: 'work_requests',
  QUOTE_INQUIRIES: 'quote_inquiries',
  FINISH_CHECK_SPACES: 'finish_check_spaces',
  FINISH_CHECK_ITEMS: 'finish_check_items',
  SPECBOOK_ITEMS: 'specbook_items',
  SPECBOOK_CATEGORIES: 'specbook_categories',
  SPECBOOK_PROJECT_ITEMS: 'specbook_project_items',
  PROCESSES: 'processes',
  USERS: 'users',
} as const;

// Firestore Timestamp를 ISO 문자열로 변환
export function timestampToString(timestamp: Timestamp | string | null | undefined): string {
  if (!timestamp) return '';
  if (typeof timestamp === 'string') return timestamp;
  if (timestamp instanceof Timestamp) {
    return timestamp.toDate().toISOString();
  }
  return '';
}

// ISO 문자열을 Firestore Timestamp로 변환
export function stringToTimestamp(dateString: string | null | undefined): Timestamp | null {
  if (!dateString) return null;
  return Timestamp.fromDate(new Date(dateString));
}

// 공통 CRUD 함수들
export async function getDocument<T>(collectionName: string, docId: string): Promise<T | null> {
  const docRef = doc(db, collectionName, docId);
  const docSnap = await getDoc(docRef);

  if (docSnap.exists()) {
    return { id: docSnap.id, ...docSnap.data() } as T;
  }
  return null;
}

export async function getAllDocuments<T>(
  collectionName: string,
  constraints: QueryConstraint[] = []
): Promise<T[]> {
  const collectionRef = collection(db, collectionName);
  const q = constraints.length > 0 ? query(collectionRef, ...constraints) : query(collectionRef);
  const querySnapshot = await getDocs(q);

  return querySnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  })) as T[];
}

export async function createDocument<T extends DocumentData>(
  collectionName: string,
  data: T
): Promise<string> {
  const collectionRef = collection(db, collectionName);
  const docRef = await addDoc(collectionRef, {
    ...data,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now()
  });
  return docRef.id;
}

export async function updateDocument(
  collectionName: string,
  docId: string,
  data: Partial<DocumentData>
): Promise<void> {
  const docRef = doc(db, collectionName, docId);
  await updateDoc(docRef, {
    ...data,
    updatedAt: Timestamp.now()
  });
}

export async function deleteDocument(collectionName: string, docId: string): Promise<void> {
  const docRef = doc(db, collectionName, docId);
  await deleteDoc(docRef);
}

// 실시간 리스너
export function subscribeToCollection<T>(
  collectionName: string,
  callback: (data: T[]) => void,
  constraints: QueryConstraint[] = []
): Unsubscribe {
  const collectionRef = collection(db, collectionName);
  const q = constraints.length > 0 ? query(collectionRef, ...constraints) : query(collectionRef);

  return onSnapshot(q, (snapshot) => {
    const data = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as T[];
    callback(data);
  });
}

export function subscribeToDocument<T>(
  collectionName: string,
  docId: string,
  callback: (data: T | null) => void
): Unsubscribe {
  const docRef = doc(db, collectionName, docId);

  return onSnapshot(docRef, (docSnap) => {
    if (docSnap.exists()) {
      callback({ id: docSnap.id, ...docSnap.data() } as T);
    } else {
      callback(null);
    }
  });
}

// re-export firebase/firestore utilities
export { where, orderBy, limit, Timestamp };
