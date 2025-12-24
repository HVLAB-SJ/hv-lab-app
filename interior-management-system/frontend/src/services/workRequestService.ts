import api from './api';
import workRequestFirestoreService from './firestore/workRequestFirestoreService';
import { getDataSourceConfig } from './firestore/dataSourceConfig';

export interface WorkRequestData {
  project: string;
  requestType: string;
  description: string;
  requestDate: Date | string;
  dueDate: Date | string;
  requestedBy: string;
  assignedTo: string;
  status?: 'pending' | 'in-progress' | 'completed' | 'cancelled';
  priority?: 'low' | 'medium' | 'high';
  notes?: string;
  completedDate?: Date | string;
}

export interface WorkRequestResponse {
  _id: string;
  project: string;
  requestType: string;
  description: string;
  requestDate: string;
  dueDate: string;
  requestedBy: string;
  assignedTo: string;
  status: 'pending' | 'in-progress' | 'completed' | 'cancelled';
  priority: 'low' | 'medium' | 'high';
  notes?: string;
  completedDate?: string;
  createdAt: string;
  updatedAt: string;
}

// Railway API 서비스 (기존)
const railwayWorkRequestService = {
  getAllWorkRequests: async (): Promise<WorkRequestResponse[]> => {
    const response = await api.get('/workrequests');
    return response.data;
  },

  getWorkRequestById: async (id: string): Promise<WorkRequestResponse> => {
    const response = await api.get(`/workrequests/${id}`);
    return response.data;
  },

  createWorkRequest: async (data: WorkRequestData): Promise<WorkRequestResponse> => {
    const backendData = {
      project: data.project,
      requestType: data.requestType,
      description: data.description,
      requestDate: data.requestDate instanceof Date ? data.requestDate.toISOString() : data.requestDate,
      dueDate: data.dueDate instanceof Date ? data.dueDate.toISOString() : data.dueDate,
      requestedBy: data.requestedBy,
      assignedTo: data.assignedTo,
      priority: data.priority || 'medium',
      status: data.status || 'pending',
      notes: data.notes || ''
    };

    console.log('[workRequestService.createWorkRequest] Sending to backend:', backendData);
    const response = await api.post('/workrequests', backendData);
    return response.data;
  },

  updateWorkRequest: async (id: string, data: Partial<WorkRequestData>): Promise<WorkRequestResponse> => {
    const backendData: Record<string, unknown> = {};
    if (data.project !== undefined) backendData.project = data.project;
    if (data.requestType !== undefined) backendData.requestType = data.requestType;
    if (data.description !== undefined) backendData.description = data.description;
    if (data.requestDate !== undefined) {
      backendData.requestDate = data.requestDate instanceof Date ? data.requestDate.toISOString() : data.requestDate;
    }
    if (data.dueDate !== undefined) {
      backendData.dueDate = data.dueDate instanceof Date ? data.dueDate.toISOString() : data.dueDate;
    }
    if (data.requestedBy !== undefined) backendData.requestedBy = data.requestedBy;
    if (data.assignedTo !== undefined) backendData.assignedTo = data.assignedTo;
    if (data.priority !== undefined) backendData.priority = data.priority;
    if (data.status !== undefined) backendData.status = data.status;
    if (data.notes !== undefined) backendData.notes = data.notes;
    if (data.completedDate !== undefined) {
      backendData.completedDate = data.completedDate instanceof Date ? data.completedDate.toISOString() : data.completedDate;
    }

    const response = await api.put(`/workrequests/${id}`, backendData);
    return response.data;
  },

  deleteWorkRequest: async (id: string): Promise<void> => {
    await api.delete(`/workrequests/${id}`);
  }
};

// 통합 서비스 (데이터 소스에 따라 자동 선택)
const workRequestService = {
  getAllWorkRequests: async (): Promise<WorkRequestResponse[]> => {
    if (getDataSourceConfig()) {
      console.log('[workRequestService] Using Firestore');
      return workRequestFirestoreService.getAllWorkRequests();
    }
    console.log('[workRequestService] Using Railway API');
    return railwayWorkRequestService.getAllWorkRequests();
  },

  getWorkRequestById: async (id: string): Promise<WorkRequestResponse> => {
    if (getDataSourceConfig()) {
      const result = await workRequestFirestoreService.getWorkRequestById(id);
      if (!result) throw new Error('Work request not found');
      return result;
    }
    return railwayWorkRequestService.getWorkRequestById(id);
  },

  createWorkRequest: async (data: WorkRequestData): Promise<WorkRequestResponse> => {
    if (getDataSourceConfig()) {
      return workRequestFirestoreService.createWorkRequest(data);
    }
    return railwayWorkRequestService.createWorkRequest(data);
  },

  updateWorkRequest: async (id: string, data: Partial<WorkRequestData>): Promise<WorkRequestResponse> => {
    if (getDataSourceConfig()) {
      return workRequestFirestoreService.updateWorkRequest(id, data);
    }
    return railwayWorkRequestService.updateWorkRequest(id, data);
  },

  deleteWorkRequest: async (id: string): Promise<void> => {
    if (getDataSourceConfig()) {
      return workRequestFirestoreService.deleteWorkRequest(id);
    }
    return railwayWorkRequestService.deleteWorkRequest(id);
  },

  // Firestore 실시간 구독 (Firestore 전용)
  subscribeToWorkRequests: workRequestFirestoreService.subscribeToWorkRequests
};

export default workRequestService;
