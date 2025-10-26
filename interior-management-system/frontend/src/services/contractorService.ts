import api from './api';

export interface ContractorData {
  rank?: string;
  companyName?: string;
  name: string;
  position?: string;
  process: string;
  contact?: string;
  accountNumber: string;
  notes?: string;
}

export interface ContractorResponse {
  _id: string;
  rank?: string;
  companyName?: string;
  name: string;
  position?: string;
  process: string;
  contact?: string;
  accountNumber: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

const contractorService = {
  // Get all contractors
  getAllContractors: async (): Promise<ContractorResponse[]> => {
    const response = await api.get('/contractors');
    return response.data;
  },

  // Get single contractor
  getContractorById: async (id: string): Promise<ContractorResponse> => {
    const response = await api.get(`/contractors/${id}`);
    return response.data;
  },

  // Create contractor
  createContractor: async (data: ContractorData): Promise<ContractorResponse> => {
    const response = await api.post('/contractors', data);
    return response.data;
  },

  // Update contractor
  updateContractor: async (id: string, data: Partial<ContractorData>): Promise<ContractorResponse> => {
    const response = await api.put(`/contractors/${id}`, data);
    return response.data;
  },

  // Delete contractor
  deleteContractor: async (id: string): Promise<void> => {
    await api.delete(`/contractors/${id}`);
  }
};

export default contractorService;
