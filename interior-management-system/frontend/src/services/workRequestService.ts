import api from './api';

export interface WorkRequestData {
  project: string;
  requestType: string; // 목공도면, 전기도면, 설비도면, 3D모델링, 기타
  description: string;
  requestDate: Date | string;
  dueDate: Date | string;
  requestedBy: string; // 요청자
  assignedTo: string; // 담당자
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

const workRequestService = {
  // Get all work requests
  getAllWorkRequests: async (): Promise<WorkRequestResponse[]> => {
    const response = await api.get('/workrequests');
    return response.data;
  },

  // Get single work request
  getWorkRequestById: async (id: string): Promise<WorkRequestResponse> => {
    const response = await api.get(`/workrequests/${id}`);
    return response.data;
  },

  // Create work request
  createWorkRequest: async (data: WorkRequestData): Promise<WorkRequestResponse> => {
    console.log('[workRequestService.createWorkRequest] Input data:', data);

    // Send all required fields to backend
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

  // Update work request
  updateWorkRequest: async (id: string, data: Partial<WorkRequestData>): Promise<WorkRequestResponse> => {
    console.log('[workRequestService.updateWorkRequest] Input data:', data);

    // Send all fields to backend (backend accepts camelCase)
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

    console.log('[workRequestService.updateWorkRequest] Sending to backend:', backendData);
    const response = await api.put(`/workrequests/${id}`, backendData);
    return response.data;
  },

  // Delete work request
  deleteWorkRequest: async (id: string): Promise<void> => {
    await api.delete(`/workrequests/${id}`);
  }
};

export default workRequestService;
