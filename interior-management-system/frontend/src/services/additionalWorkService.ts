import api from './api';

export interface AdditionalWorkData {
  project: string;
  description: string;
  amount: number;
  date: Date;
  notes?: string;
}

export interface AdditionalWorkResponse {
  _id: string;
  project: string;
  description: string;
  amount: number;
  date: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

const additionalWorkService = {
  // Get all additional works
  getAllAdditionalWorks: async (): Promise<AdditionalWorkResponse[]> => {
    const response = await api.get('/additional-works');
    return response.data;
  },

  // Get single additional work
  getAdditionalWorkById: async (id: string): Promise<AdditionalWorkResponse> => {
    const response = await api.get(`/additional-works/${id}`);
    return response.data;
  },

  // Create additional work
  createAdditionalWork: async (data: AdditionalWorkData): Promise<AdditionalWorkResponse> => {
    // Send project name (not project_id) - backend will look up the ID
    const backendData = {
      project: data.project,  // Send project name, backend will convert to project_id
      description: data.description,
      amount: data.amount,
      work_date: data.date instanceof Date ? data.date.toISOString().split('T')[0] : data.date,
      notes: data.notes || ''
    };
    console.log('[additionalWorkService.createAdditionalWork] Sending to backend:', backendData);
    const response = await api.post('/additional-works', backendData);
    return response.data;
  },

  // Update additional work
  updateAdditionalWork: async (id: string, data: Partial<AdditionalWorkData>): Promise<AdditionalWorkResponse> => {
    // Send project name (not project_id) - backend will look up the ID
    const backendData: Record<string, unknown> = {};
    if (data.project !== undefined) backendData.project = data.project;  // Send project name
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

  // Delete additional work
  deleteAdditionalWork: async (id: string): Promise<void> => {
    await api.delete(`/additional-works/${id}`);
  }
};

export default additionalWorkService;
