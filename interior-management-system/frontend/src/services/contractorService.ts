import contractorFirestoreService from './firestore/contractorFirestoreService';

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

// Firebase Firestore 전용 서비스
const contractorService = {
  getAllContractors: (): Promise<ContractorResponse[]> => {
    return contractorFirestoreService.getAllContractors();
  },

  getContractorById: async (id: string): Promise<ContractorResponse> => {
    const result = await contractorFirestoreService.getContractorById(id);
    if (!result) throw new Error('Contractor not found');
    return result;
  },

  createContractor: (data: ContractorData): Promise<ContractorResponse> => {
    return contractorFirestoreService.createContractor(data);
  },

  updateContractor: (id: string, data: Partial<ContractorData>): Promise<ContractorResponse> => {
    return contractorFirestoreService.updateContractor(id, data);
  },

  deleteContractor: (id: string): Promise<void> => {
    return contractorFirestoreService.deleteContractor(id);
  },

  // Firestore 실시간 구독
  subscribeToContractors: contractorFirestoreService.subscribeToContractors
};

export default contractorService;
