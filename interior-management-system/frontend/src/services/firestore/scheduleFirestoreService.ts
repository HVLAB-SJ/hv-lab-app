/**
 * Schedule Firestore Service
 * 스케줄 데이터를 Firestore에서 직접 관리
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
import type { ScheduleResponse, ScheduleData } from '../scheduleService';

const COLLECTION_NAME = 'schedules';

// Firestore 문서를 ScheduleResponse 형식으로 변환
const convertDoc = (docSnap: any): ScheduleResponse => {
  const data = docSnap.data();
  return {
    _id: docSnap.id,
    project: data.project || { _id: '', name: '' },
    title: data.title || '',
    type: data.type || 'other',
    phase: data.phase || '',
    startDate: data.startDate instanceof Timestamp
      ? data.startDate.toDate().toISOString()
      : data.startDate || '',
    endDate: data.endDate instanceof Timestamp
      ? data.endDate.toDate().toISOString()
      : data.endDate || '',
    allDay: data.allDay ?? true,
    assignedTo: data.assignedTo || [],
    assigneeNames: data.assigneeNames || [],
    description: data.description || '',
    location: data.location || '',
    priority: data.priority || 'medium',
    progress: data.progress ?? 0,
    isCompleted: data.isCompleted ?? false,
    completedAt: data.completedAt instanceof Timestamp
      ? data.completedAt.toDate().toISOString()
      : data.completedAt,
    createdBy: data.createdBy || { _id: '', name: '', username: '' },
    createdAt: data.createdAt instanceof Timestamp
      ? data.createdAt.toDate().toISOString()
      : data.createdAt || '',
    updatedAt: data.updatedAt instanceof Timestamp
      ? data.updatedAt.toDate().toISOString()
      : data.updatedAt || '',
    time: data.time || ''
  };
};

const scheduleFirestoreService = {
  // 모든 스케줄 조회
  getAllSchedules: async (): Promise<ScheduleResponse[]> => {
    const q = query(collection(db, COLLECTION_NAME), orderBy('startDate', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(convertDoc);
  },

  // 단일 스케줄 조회
  getScheduleById: async (id: string): Promise<ScheduleResponse | null> => {
    const docRef = doc(db, COLLECTION_NAME, id);
    const docSnap = await getDoc(docRef);
    if (!docSnap.exists()) return null;
    return convertDoc(docSnap);
  },

  // 스케줄 생성
  createSchedule: async (data: ScheduleData): Promise<ScheduleResponse> => {
    const now = Timestamp.now();
    const newData = {
      project: typeof data.project === 'string'
        ? { _id: data.project, name: data.project }
        : data.project,
      title: data.title,
      type: data.type || 'other',
      phase: data.phase || '',
      startDate: data.startDate instanceof Date
        ? Timestamp.fromDate(data.startDate)
        : data.startDate,
      endDate: data.endDate instanceof Date
        ? Timestamp.fromDate(data.endDate)
        : data.endDate,
      allDay: data.allDay ?? true,
      assignedTo: data.assignedTo || [],
      description: data.description || '',
      location: data.location || '',
      priority: data.priority || 'medium',
      progress: data.progress ?? 0,
      isCompleted: data.isCompleted ?? false,
      time: data.time || '',
      asRequestId: data.asRequestId || null,
      createdAt: now,
      updatedAt: now
    };

    const docRef = await addDoc(collection(db, COLLECTION_NAME), newData);
    const created = await getDoc(docRef);
    return convertDoc(created);
  },

  // 스케줄 수정
  updateSchedule: async (id: string, data: Partial<ScheduleData>): Promise<ScheduleResponse> => {
    const docRef = doc(db, COLLECTION_NAME, id);
    const updateData: Record<string, any> = {
      updatedAt: Timestamp.now()
    };

    if (data.project !== undefined) {
      updateData.project = typeof data.project === 'string'
        ? { _id: data.project, name: data.project }
        : data.project;
    }
    if (data.title !== undefined) updateData.title = data.title;
    if (data.type !== undefined) updateData.type = data.type;
    if (data.phase !== undefined) updateData.phase = data.phase;
    if (data.startDate !== undefined) {
      updateData.startDate = data.startDate instanceof Date
        ? Timestamp.fromDate(data.startDate)
        : data.startDate;
    }
    if (data.endDate !== undefined) {
      updateData.endDate = data.endDate instanceof Date
        ? Timestamp.fromDate(data.endDate)
        : data.endDate;
    }
    if (data.allDay !== undefined) updateData.allDay = data.allDay;
    if (data.assignedTo !== undefined) updateData.assignedTo = data.assignedTo;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.location !== undefined) updateData.location = data.location;
    if (data.priority !== undefined) updateData.priority = data.priority;
    if (data.progress !== undefined) updateData.progress = data.progress;
    if (data.isCompleted !== undefined) {
      updateData.isCompleted = data.isCompleted;
      if (data.isCompleted) {
        updateData.completedAt = Timestamp.now();
      }
    }
    if (data.time !== undefined) updateData.time = data.time;

    await updateDoc(docRef, updateData);
    const updated = await getDoc(docRef);
    return convertDoc(updated);
  },

  // 스케줄 삭제
  deleteSchedule: async (id: string): Promise<void> => {
    const docRef = doc(db, COLLECTION_NAME, id);
    await deleteDoc(docRef);
  },

  // 실시간 구독
  subscribeToSchedules: (callback: (schedules: ScheduleResponse[]) => void) => {
    const q = query(collection(db, COLLECTION_NAME), orderBy('startDate', 'desc'));
    return onSnapshot(q, (snapshot) => {
      const schedules = snapshot.docs.map(convertDoc);
      callback(schedules);
    });
  }
};

export default scheduleFirestoreService;
