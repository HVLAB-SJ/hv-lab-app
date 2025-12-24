import additionalWorkFirestoreService from './firestore/additionalWorkFirestoreService';

export interface AdditionalWorkData {
  project: string;
  description: string;
  amount: number;
  date: Date;
  notes?: string;
  images?: string[];
}

export interface AdditionalWorkResponse {
  _id: string;
  project: string;
  description: string;
  amount: number;
  date: string;
  notes?: string;
  images?: string[];
  createdAt: string;
  updatedAt: string;
}

// Firebase Firestore 전용 서비스
const additionalWorkService = {
  getAllAdditionalWorks: (): Promise<AdditionalWorkResponse[]> => {
    return additionalWorkFirestoreService.getAllAdditionalWorks();
  },

  getAdditionalWorkById: async (id: string): Promise<AdditionalWorkResponse> => {
    const result = await additionalWorkFirestoreService.getAdditionalWorkById(id);
    if (!result) throw new Error('Additional work not found');
    return result;
  },

  createAdditionalWork: (data: AdditionalWorkData): Promise<AdditionalWorkResponse> => {
    return additionalWorkFirestoreService.createAdditionalWork(data);
  },

  updateAdditionalWork: (id: string, data: Partial<AdditionalWorkData>): Promise<AdditionalWorkResponse> => {
    return additionalWorkFirestoreService.updateAdditionalWork(id, data);
  },

  deleteAdditionalWork: (id: string): Promise<void> => {
    return additionalWorkFirestoreService.deleteAdditionalWork(id);
  },

  // Firestore 실시간 구독
  subscribeToAdditionalWorks: additionalWorkFirestoreService.subscribeToAdditionalWorks
};

export default additionalWorkService;
