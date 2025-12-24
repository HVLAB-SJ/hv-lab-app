import asRequestFirestoreService from './firestore/asRequestFirestoreService';

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

// Firebase Firestore 전용 서비스
const asRequestService = {
  getAllASRequests: (): Promise<ASRequestResponse[]> => {
    return asRequestFirestoreService.getAllASRequests();
  },

  getASRequestById: async (id: string): Promise<ASRequestResponse> => {
    const result = await asRequestFirestoreService.getASRequestById(id);
    if (!result) throw new Error('AS Request not found');
    return result;
  },

  createASRequest: (data: ASRequestData): Promise<ASRequestResponse> => {
    return asRequestFirestoreService.createASRequest(data);
  },

  updateASRequest: (id: string, data: Partial<ASRequestData>): Promise<ASRequestResponse> => {
    return asRequestFirestoreService.updateASRequest(id, data);
  },

  deleteASRequest: (id: string): Promise<void> => {
    return asRequestFirestoreService.deleteASRequest(id);
  },

  // Firestore 실시간 구독
  subscribeToASRequests: asRequestFirestoreService.subscribeToASRequests
};

export default asRequestService;
