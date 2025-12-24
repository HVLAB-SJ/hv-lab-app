/**
 * Additional Work Firestore Service
 * 추가공사 데이터를 Firestore에서 직접 관리
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
import type { AdditionalWorkResponse, AdditionalWorkData } from '../additionalWorkService';
import { uploadImagesToStorage, deleteImagesFromStorage, isBase64Image } from './storageService';

const COLLECTION_NAME = 'additional_works';

// Firestore 문서를 AdditionalWorkResponse 형식으로 변환
const convertDoc = (docSnap: any): AdditionalWorkResponse => {
  const data = docSnap.data();
  return {
    _id: docSnap.id,
    project: data.project || '',
    description: data.description || '',
    amount: data.amount || 0,
    date: data.date instanceof Timestamp
      ? data.date.toDate().toISOString().split('T')[0]
      : data.date || data.work_date || '',
    notes: data.notes || '',
    images: data.images || [],
    createdAt: data.createdAt instanceof Timestamp
      ? data.createdAt.toDate().toISOString()
      : data.createdAt || '',
    updatedAt: data.updatedAt instanceof Timestamp
      ? data.updatedAt.toDate().toISOString()
      : data.updatedAt || ''
  };
};

const additionalWorkFirestoreService = {
  // 모든 추가공사 조회
  getAllAdditionalWorks: async (): Promise<AdditionalWorkResponse[]> => {
    const q = query(collection(db, COLLECTION_NAME), orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(convertDoc);
  },

  // 단일 추가공사 조회
  getAdditionalWorkById: async (id: string): Promise<AdditionalWorkResponse | null> => {
    const docRef = doc(db, COLLECTION_NAME, id);
    const docSnap = await getDoc(docRef);
    if (!docSnap.exists()) return null;
    return convertDoc(docSnap);
  },

  // 추가공사 생성
  createAdditionalWork: async (data: AdditionalWorkData): Promise<AdditionalWorkResponse> => {
    const now = Timestamp.now();
    const tempData = {
      project: data.project,
      description: data.description,
      amount: data.amount,
      date: data.date instanceof Date
        ? Timestamp.fromDate(data.date)
        : data.date,
      notes: data.notes || '',
      images: [],
      createdAt: now,
      updatedAt: now
    };

    const docRef = await addDoc(collection(db, COLLECTION_NAME), tempData);

    // Base64 이미지를 Storage로 업로드
    if (data.images && data.images.length > 0) {
      const hasBase64 = data.images.some(img => isBase64Image(img));
      if (hasBase64) {
        const imageUrls = await uploadImagesToStorage('additional_works', docRef.id, data.images);
        await updateDoc(docRef, { images: imageUrls });
      } else {
        await updateDoc(docRef, { images: data.images });
      }
    }

    const created = await getDoc(docRef);
    return convertDoc(created);
  },

  // 추가공사 수정
  updateAdditionalWork: async (id: string, data: Partial<AdditionalWorkData>): Promise<AdditionalWorkResponse> => {
    const docRef = doc(db, COLLECTION_NAME, id);
    const updateData: Record<string, any> = {
      updatedAt: Timestamp.now()
    };

    if (data.project !== undefined) updateData.project = data.project;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.amount !== undefined) updateData.amount = data.amount;
    if (data.date !== undefined) {
      updateData.date = data.date instanceof Date
        ? Timestamp.fromDate(data.date)
        : data.date;
    }
    if (data.notes !== undefined) updateData.notes = data.notes;

    // 이미지 업데이트 시 Storage 업로드
    if (data.images !== undefined) {
      const hasBase64 = data.images.some(img => isBase64Image(img));
      if (hasBase64) {
        updateData.images = await uploadImagesToStorage('additional_works', id, data.images);
      } else {
        updateData.images = data.images;
      }
    }

    await updateDoc(docRef, updateData);
    const updated = await getDoc(docRef);
    return convertDoc(updated);
  },

  // 추가공사 삭제
  deleteAdditionalWork: async (id: string): Promise<void> => {
    const docRef = doc(db, COLLECTION_NAME, id);

    // 기존 이미지 삭제
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      const data = docSnap.data();
      if (data.images && data.images.length > 0) {
        await deleteImagesFromStorage(data.images);
      }
    }

    await deleteDoc(docRef);
  },

  // 실시간 구독
  subscribeToAdditionalWorks: (callback: (works: AdditionalWorkResponse[]) => void) => {
    const q = query(collection(db, COLLECTION_NAME), orderBy('createdAt', 'desc'));
    return onSnapshot(q, (snapshot) => {
      const works = snapshot.docs.map(convertDoc);
      callback(works);
    });
  }
};

export default additionalWorkFirestoreService;
