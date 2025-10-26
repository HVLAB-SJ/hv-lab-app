import api from './api';

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

const asRequestService = {
  // Get all AS requests
  getAllASRequests: async (): Promise<ASRequestResponse[]> => {
    const response = await api.get('/as-requests');
    return response.data;
  },

  // Get single AS request
  getASRequestById: async (id: string): Promise<ASRequestResponse> => {
    const response = await api.get(`/as-requests/${id}`);
    return response.data;
  },

  // Create AS request
  createASRequest: async (data: ASRequestData): Promise<ASRequestResponse> => {
    const response = await api.post('/as-requests', data);
    return response.data;
  },

  // Update AS request
  updateASRequest: async (id: string, data: Partial<ASRequestData>): Promise<ASRequestResponse> => {
    const response = await api.put(`/as-requests/${id}`, data);
    return response.data;
  },

  // Delete AS request
  deleteASRequest: async (id: string): Promise<void> => {
    await api.delete(`/as-requests/${id}`);
  }
};

export default asRequestService;
