import api from './api';
import contractorFirestoreService from './firestore/contractorFirestoreService';
import { getDataSourceConfig } from './firestore/dataSourceConfig';

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

// Railway API 서비스 (기존)
const railwayContractorService = {
  getAllContractors: async (): Promise<ContractorResponse[]> => {
    const response = await api.get('/contractors');
    return response.data;
  },

  getContractorById: async (id: string): Promise<ContractorResponse> => {
    const response = await api.get(`/contractors/${id}`);
    return response.data;
  },

  createContractor: async (data: ContractorData): Promise<ContractorResponse> => {
    const response = await api.post('/contractors', data);
    return response.data;
  },

  updateContractor: async (id: string, data: Partial<ContractorData>): Promise<ContractorResponse> => {
    const response = await api.put(`/contractors/${id}`, data);
    return response.data;
  },

  deleteContractor: async (id: string): Promise<void> => {
    await api.delete(`/contractors/${id}`);
  }
};

// 통합 서비스 (데이터 소스에 따라 자동 선택)
const contractorService = {
  getAllContractors: async (): Promise<ContractorResponse[]> => {
    if (getDataSourceConfig()) {
      console.log('[contractorService] Using Firestore');
      return contractorFirestoreService.getAllContractors();
    }
    console.log('[contractorService] Using Railway API');
    return railwayContractorService.getAllContractors();
  },

  getContractorById: async (id: string): Promise<ContractorResponse> => {
    if (getDataSourceConfig()) {
      const result = await contractorFirestoreService.getContractorById(id);
      if (!result) throw new Error('Contractor not found');
      return result;
    }
    return railwayContractorService.getContractorById(id);
  },

  createContractor: async (data: ContractorData): Promise<ContractorResponse> => {
    if (getDataSourceConfig()) {
      return contractorFirestoreService.createContractor(data);
    }
    return railwayContractorService.createContractor(data);
  },

  updateContractor: async (id: string, data: Partial<ContractorData>): Promise<ContractorResponse> => {
    if (getDataSourceConfig()) {
      return contractorFirestoreService.updateContractor(id, data);
    }
    return railwayContractorService.updateContractor(id, data);
  },

  deleteContractor: async (id: string): Promise<void> => {
    if (getDataSourceConfig()) {
      return contractorFirestoreService.deleteContractor(id);
    }
    return railwayContractorService.deleteContractor(id);
  },

  // Firestore 실시간 구독 (Firestore 전용)
  subscribeToContractors: contractorFirestoreService.subscribeToContractors
};

export default contractorService;
