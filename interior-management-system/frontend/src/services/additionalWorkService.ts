import api from './api';
import additionalWorkFirestoreService from './firestore/additionalWorkFirestoreService';
import { getDataSourceConfig } from './firestore/dataSourceConfig';

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

// Railway API 서비스 (기존)
const railwayAdditionalWorkService = {
  getAllAdditionalWorks: async (): Promise<AdditionalWorkResponse[]> => {
    const response = await api.get('/additional-works');
    return response.data;
  },

  getAdditionalWorkById: async (id: string): Promise<AdditionalWorkResponse> => {
    const response = await api.get(`/additional-works/${id}`);
    return response.data;
  },

  createAdditionalWork: async (data: AdditionalWorkData): Promise<AdditionalWorkResponse> => {
    const backendData = {
      project: data.project,
      description: data.description,
      amount: data.amount,
      work_date: data.date instanceof Date ? data.date.toISOString().split('T')[0] : data.date,
      notes: data.notes || '',
      images: data.images || []
    };
    console.log('[additionalWorkService.createAdditionalWork] Sending to backend:', backendData);
    const response = await api.post('/additional-works', backendData);
    return response.data;
  },

  updateAdditionalWork: async (id: string, data: Partial<AdditionalWorkData>): Promise<AdditionalWorkResponse> => {
    const backendData: Record<string, unknown> = {};
    if (data.project !== undefined) backendData.project = data.project;
    if (data.description !== undefined) backendData.description = data.description;
    if (data.amount !== undefined) backendData.amount = data.amount;
    if (data.date !== undefined) {
      backendData.work_date = data.date instanceof Date ? data.date.toISOString().split('T')[0] : data.date;
    }
    if (data.notes !== undefined) backendData.notes = data.notes;

    console.log('[additionalWorkService.updateAdditionalWork] Sending to backend:', backendData);

    const response = await api.put(`/additional-works/${id}`, backendData);
    return response.data;
  },

  deleteAdditionalWork: async (id: string): Promise<void> => {
    await api.delete(`/additional-works/${id}`);
  }
};

// 통합 서비스 (데이터 소스에 따라 자동 선택)
const additionalWorkService = {
  getAllAdditionalWorks: async (): Promise<AdditionalWorkResponse[]> => {
    if (getDataSourceConfig()) {
      console.log('[additionalWorkService] Using Firestore');
      return additionalWorkFirestoreService.getAllAdditionalWorks();
    }
    console.log('[additionalWorkService] Using Railway API');
    return railwayAdditionalWorkService.getAllAdditionalWorks();
  },

  getAdditionalWorkById: async (id: string): Promise<AdditionalWorkResponse> => {
    if (getDataSourceConfig()) {
      const result = await additionalWorkFirestoreService.getAdditionalWorkById(id);
      if (!result) throw new Error('Additional work not found');
      return result;
    }
    return railwayAdditionalWorkService.getAdditionalWorkById(id);
  },

  createAdditionalWork: async (data: AdditionalWorkData): Promise<AdditionalWorkResponse> => {
    if (getDataSourceConfig()) {
      return additionalWorkFirestoreService.createAdditionalWork(data);
    }
    return railwayAdditionalWorkService.createAdditionalWork(data);
  },

  updateAdditionalWork: async (id: string, data: Partial<AdditionalWorkData>): Promise<AdditionalWorkResponse> => {
    if (getDataSourceConfig()) {
      return additionalWorkFirestoreService.updateAdditionalWork(id, data);
    }
    return railwayAdditionalWorkService.updateAdditionalWork(id, data);
  },

  deleteAdditionalWork: async (id: string): Promise<void> => {
    if (getDataSourceConfig()) {
      return additionalWorkFirestoreService.deleteAdditionalWork(id);
    }
    return railwayAdditionalWorkService.deleteAdditionalWork(id);
  },

  // Firestore 실시간 구독 (Firestore 전용)
  subscribeToAdditionalWorks: additionalWorkFirestoreService.subscribeToAdditionalWorks
};

export default additionalWorkService;
