import api from './api';
import asRequestFirestoreService from './firestore/asRequestFirestoreService';
import { getDataSourceConfig } from './firestore/dataSourceConfig';

export interface ASRequestData {
  project: string;
  client: string;
  requestDate: Date;
  siteAddress: string;
  entrancePassword: string;
  description: string;
  scheduledVisitDate?: Date;
  scheduledVisitTime?: string;
  assignedTo?: string;
  completionDate?: Date;
  notes?: string;
  status?: 'pending' | 'completed' | 'revisit';
}

export interface ASRequestResponse {
  _id: string;
  project: string;
  client: string;
  requestDate: string;
  siteAddress: string;
  entrancePassword: string;
  description: string;
  scheduledVisitDate?: string;
  scheduledVisitTime?: string;
  assignedTo?: string;
  completionDate?: string;
  notes?: string;
  status?: 'pending' | 'completed' | 'revisit';
  createdAt: string;
  updatedAt: string;
}

// Railway API 서비스 (기존)
const railwayAsRequestService = {
  getAllASRequests: async (): Promise<ASRequestResponse[]> => {
    const response = await api.get('/as-requests');
    return response.data;
  },

  getASRequestById: async (id: string): Promise<ASRequestResponse> => {
    const response = await api.get(`/as-requests/${id}`);
    return response.data;
  },

  createASRequest: async (data: ASRequestData): Promise<ASRequestResponse> => {
    const response = await api.post('/as-requests', data);
    return response.data;
  },

  updateASRequest: async (id: string, data: Partial<ASRequestData>): Promise<ASRequestResponse> => {
    const response = await api.put(`/as-requests/${id}`, data);
    return response.data;
  },

  deleteASRequest: async (id: string): Promise<void> => {
    await api.delete(`/as-requests/${id}`);
  }
};

// 통합 서비스 (데이터 소스에 따라 자동 선택)
const asRequestService = {
  getAllASRequests: async (): Promise<ASRequestResponse[]> => {
    if (getDataSourceConfig()) {
      console.log('[asRequestService] Using Firestore');
      return asRequestFirestoreService.getAllASRequests();
    }
    console.log('[asRequestService] Using Railway API');
    return railwayAsRequestService.getAllASRequests();
  },

  getASRequestById: async (id: string): Promise<ASRequestResponse> => {
    if (getDataSourceConfig()) {
      const result = await asRequestFirestoreService.getASRequestById(id);
      if (!result) throw new Error('AS Request not found');
      return result;
    }
    return railwayAsRequestService.getASRequestById(id);
  },

  createASRequest: async (data: ASRequestData): Promise<ASRequestResponse> => {
    if (getDataSourceConfig()) {
      return asRequestFirestoreService.createASRequest(data);
    }
    return railwayAsRequestService.createASRequest(data);
  },

  updateASRequest: async (id: string, data: Partial<ASRequestData>): Promise<ASRequestResponse> => {
    if (getDataSourceConfig()) {
      return asRequestFirestoreService.updateASRequest(id, data);
    }
    return railwayAsRequestService.updateASRequest(id, data);
  },

  deleteASRequest: async (id: string): Promise<void> => {
    if (getDataSourceConfig()) {
      return asRequestFirestoreService.deleteASRequest(id);
    }
    return railwayAsRequestService.deleteASRequest(id);
  },

  // Firestore 실시간 구독 (Firestore 전용)
  subscribeToASRequests: asRequestFirestoreService.subscribeToASRequests
};

export default asRequestService;
