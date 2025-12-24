/**
 * 프로젝트 Firestore 서비스
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
  onSnapshot,
  Unsubscribe,
  Timestamp
} from 'firebase/firestore';
import { COLLECTIONS, timestampToString } from './index';

// Firestore 프로젝트 타입
export interface FirestoreProject {
  id: string;
  name: string;
  client: string;
  address: string;
  startDate: string | null;
  endDate: string | null;
  status: 'planning' | 'in-progress' | 'completed' | 'on-hold';
  color: string;
  managerId: number | null;
  manager: string;
  managerName: string;
  managerUsername: string;
  description: string;
  meetingNotes: Array<{
    id: string;
    content: string;
    date: string;
  }>;
  customerRequests: Array<{
    id: string;
    content: string;
    completed: boolean;
    createdAt: string;
  }>;
  entrancePassword: string;
  sitePassword: string;
  createdAt: string;
  updatedAt: string;
}

// 기존 API 응답 형식과 호환되는 타입
export interface ProjectResponse {
  _id: string;
  id: number;
  name: string;
  client: {
    name: string;
    phone: string;
    email?: string;
    address: string;
  };
  location: {
    address: string;
    detailAddress?: string;
    coordinates?: {
      lat: number;
      lng: number;
    };
  };
  startDate: string;
  endDate: string;
  status: 'planning' | 'inProgress' | 'completed' | 'onHold';
  budget: number;
  actualCost: number;
  manager: {
    _id: string;
    name: string;
    username: string;
  } | string;
  fieldManagers: Array<{
    _id: string;
    name: string;
    username: string;
  } | string>;
  workers: Array<{
    _id: string;
    name: string;
    username: string;
  } | string>;
  colorCode: string;
  progress: number;
  description?: string;
  attachments: Array<{
    name: string;
    url: string;
    type: string;
    uploadedAt: string;
  }>;
  createdBy: {
    _id: string;
    name: string;
    username: string;
  };
  createdAt: string;
  updatedAt: string;
  // 추가 필드
  meetingNotes?: Array<{
    id: string;
    content: string;
    date: string | Date;
  }>;
  customerRequests?: Array<{
    id: string;
    content: string;
    completed: boolean;
    createdAt: string | Date;
  }>;
  entrancePassword?: string;
  sitePassword?: string;
}

// Firestore 데이터를 API 응답 형식으로 변환
function convertToProjectResponse(firestoreData: FirestoreProject): ProjectResponse {
  // status 변환: 'in-progress' -> 'inProgress', 'on-hold' -> 'onHold'
  const statusMap: Record<string, 'planning' | 'inProgress' | 'completed' | 'onHold'> = {
    'planning': 'planning',
    'in-progress': 'inProgress',
    'completed': 'completed',
    'on-hold': 'onHold'
  };

  return {
    _id: firestoreData.id,
    id: parseInt(firestoreData.id) || 0,
    name: firestoreData.name,
    client: {
      name: firestoreData.client || '',
      phone: '',
      address: firestoreData.address || ''
    },
    location: {
      address: firestoreData.address || ''
    },
    startDate: firestoreData.startDate || '',
    endDate: firestoreData.endDate || '',
    status: statusMap[firestoreData.status] || 'planning',
    budget: 0,
    actualCost: 0,
    manager: {
      _id: String(firestoreData.managerId || ''),
      name: firestoreData.managerName || firestoreData.manager || '',
      username: firestoreData.managerUsername || ''
    },
    fieldManagers: [],
    workers: [],
    colorCode: firestoreData.color || '#4A90E2',
    progress: 0,
    description: firestoreData.description || '',
    attachments: [],
    createdBy: {
      _id: '',
      name: '',
      username: ''
    },
    createdAt: firestoreData.createdAt || '',
    updatedAt: firestoreData.updatedAt || '',
    meetingNotes: firestoreData.meetingNotes || [],
    customerRequests: firestoreData.customerRequests || [],
    entrancePassword: firestoreData.entrancePassword || '',
    sitePassword: firestoreData.sitePassword || ''
  };
}

// API 요청 형식을 Firestore 형식으로 변환
function convertToFirestoreFormat(data: Partial<ProjectResponse> | Record<string, unknown>): Partial<FirestoreProject> {
  const result: Partial<FirestoreProject> = {};

  if (data.name !== undefined) result.name = data.name as string;
  if (data.client !== undefined) {
    result.client = typeof data.client === 'string'
      ? data.client
      : (data.client as { name?: string })?.name || '';
  }
  if (data.location !== undefined) {
    result.address = typeof data.location === 'string'
      ? data.location
      : (data.location as { address?: string })?.address || '';
  }
  if ((data as any).address !== undefined) {
    result.address = (data as any).address;
  }
  if (data.startDate !== undefined) {
    result.startDate = typeof data.startDate === 'string'
      ? data.startDate
      : (data.startDate as Date)?.toISOString?.()?.split('T')[0] || null;
  }
  if (data.endDate !== undefined) {
    result.endDate = typeof data.endDate === 'string'
      ? data.endDate
      : (data.endDate as Date)?.toISOString?.()?.split('T')[0] || null;
  }
  if (data.status !== undefined) {
    // status 변환: 'inProgress' -> 'in-progress', 'onHold' -> 'on-hold'
    const statusMap: Record<string, 'planning' | 'in-progress' | 'completed' | 'on-hold'> = {
      'planning': 'planning',
      'inProgress': 'in-progress',
      'in-progress': 'in-progress',
      'completed': 'completed',
      'onHold': 'on-hold',
      'on-hold': 'on-hold'
    };
    result.status = statusMap[data.status as string] || 'planning';
  }
  if (data.description !== undefined) result.description = data.description as string;
  if ((data as any).manager !== undefined) result.manager = (data as any).manager;
  if ((data as any).meetingNotes !== undefined) result.meetingNotes = (data as any).meetingNotes;
  if ((data as any).customerRequests !== undefined) result.customerRequests = (data as any).customerRequests;
  if ((data as any).entrancePassword !== undefined) result.entrancePassword = (data as any).entrancePassword;
  if ((data as any).sitePassword !== undefined) result.sitePassword = (data as any).sitePassword;
  if ((data as any).color !== undefined) result.color = (data as any).color;
  if (data.colorCode !== undefined) result.color = data.colorCode;

  return result;
}

const projectFirestoreService = {
  // 모든 프로젝트 조회
  getAllProjects: async (): Promise<ProjectResponse[]> => {
    const collectionRef = collection(db, COLLECTIONS.PROJECTS);
    const q = query(collectionRef, orderBy('id', 'desc'));
    const querySnapshot = await getDocs(q);

    return querySnapshot.docs.map(doc => {
      const data = doc.data() as FirestoreProject;
      return convertToProjectResponse({ ...data, id: doc.id });
    });
  },

  // 단일 프로젝트 조회
  getProjectById: async (id: string): Promise<ProjectResponse | null> => {
    const docRef = doc(db, COLLECTIONS.PROJECTS, id);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      const data = docSnap.data() as FirestoreProject;
      return convertToProjectResponse({ ...data, id: docSnap.id });
    }
    return null;
  },

  // 프로젝트 생성
  createProject: async (data: Record<string, unknown>): Promise<ProjectResponse> => {
    // 새 문서 ID 생성 (현재 최대 ID + 1)
    const collectionRef = collection(db, COLLECTIONS.PROJECTS);
    const querySnapshot = await getDocs(collectionRef);

    let maxId = 0;
    querySnapshot.docs.forEach(doc => {
      const id = parseInt(doc.id);
      if (!isNaN(id) && id > maxId) {
        maxId = id;
      }
    });
    const newId = String(maxId + 1);

    const firestoreData = convertToFirestoreFormat(data);
    const now = new Date().toISOString();

    const newProject: FirestoreProject = {
      id: newId,
      name: firestoreData.name || '',
      client: firestoreData.client || '',
      address: firestoreData.address || '',
      startDate: firestoreData.startDate || null,
      endDate: firestoreData.endDate || null,
      status: firestoreData.status || 'planning',
      color: firestoreData.color || '#4A90E2',
      managerId: null,
      manager: firestoreData.manager || '',
      managerName: '',
      managerUsername: '',
      description: firestoreData.description || '',
      meetingNotes: firestoreData.meetingNotes || [],
      customerRequests: firestoreData.customerRequests || [],
      entrancePassword: firestoreData.entrancePassword || '',
      sitePassword: firestoreData.sitePassword || '',
      createdAt: now,
      updatedAt: now
    };

    const docRef = doc(db, COLLECTIONS.PROJECTS, newId);
    await setDoc(docRef, newProject);

    return convertToProjectResponse(newProject);
  },

  // 프로젝트 수정
  updateProject: async (id: string, data: Partial<ProjectResponse> | Record<string, unknown>): Promise<ProjectResponse> => {
    const docRef = doc(db, COLLECTIONS.PROJECTS, id);
    const firestoreData = convertToFirestoreFormat(data);

    await updateDoc(docRef, {
      ...firestoreData,
      updatedAt: new Date().toISOString()
    });

    // 업데이트된 데이터 반환
    const updated = await projectFirestoreService.getProjectById(id);
    if (!updated) {
      throw new Error('Project not found after update');
    }
    return updated;
  },

  // 프로젝트 삭제
  deleteProject: async (id: string): Promise<void> => {
    const docRef = doc(db, COLLECTIONS.PROJECTS, id);
    await deleteDoc(docRef);
  },

  // 실시간 프로젝트 목록 구독
  subscribeToProjects: (callback: (projects: ProjectResponse[]) => void): Unsubscribe => {
    const collectionRef = collection(db, COLLECTIONS.PROJECTS);
    const q = query(collectionRef, orderBy('id', 'desc'));

    return onSnapshot(q, (snapshot) => {
      const projects = snapshot.docs.map(doc => {
        const data = doc.data() as FirestoreProject;
        return convertToProjectResponse({ ...data, id: doc.id });
      });
      callback(projects);
    });
  },

  // 실시간 단일 프로젝트 구독
  subscribeToProject: (id: string, callback: (project: ProjectResponse | null) => void): Unsubscribe => {
    const docRef = doc(db, COLLECTIONS.PROJECTS, id);

    return onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data() as FirestoreProject;
        callback(convertToProjectResponse({ ...data, id: docSnap.id }));
      } else {
        callback(null);
      }
    });
  }
};

export default projectFirestoreService;
