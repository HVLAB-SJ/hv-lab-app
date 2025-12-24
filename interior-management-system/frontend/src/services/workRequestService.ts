import workRequestFirestoreService from './firestore/workRequestFirestoreService';

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

// Firebase Firestore 전용 서비스
const workRequestService = {
  getAllWorkRequests: (): Promise<WorkRequestResponse[]> => {
    return workRequestFirestoreService.getAllWorkRequests();
  },

  getWorkRequestById: async (id: string): Promise<WorkRequestResponse> => {
    const result = await workRequestFirestoreService.getWorkRequestById(id);
    if (!result) throw new Error('Work request not found');
    return result;
  },

  createWorkRequest: (data: WorkRequestData): Promise<WorkRequestResponse> => {
    return workRequestFirestoreService.createWorkRequest(data);
  },

  updateWorkRequest: (id: string, data: Partial<WorkRequestData>): Promise<WorkRequestResponse> => {
    return workRequestFirestoreService.updateWorkRequest(id, data);
  },

  deleteWorkRequest: (id: string): Promise<void> => {
    return workRequestFirestoreService.deleteWorkRequest(id);
  },

  // Firestore 실시간 구독
  subscribeToWorkRequests: workRequestFirestoreService.subscribeToWorkRequests
};

export default workRequestService;
