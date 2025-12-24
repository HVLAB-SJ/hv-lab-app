import executionRecordFirestoreService from './firestore/executionRecordFirestoreService';

export interface ExecutionRecordResponse {
  id: number;
  project_id: number;
  project_name: string;
  author: string;
  date: string;
  process: string;
  item_name: string;
  material_cost: number;
  labor_cost: number;
  vat_amount: number;
  total_amount: number;
  notes: string;
  images: string[];
  payment_id: number | null;
  includes_tax_deduction: number;
  includes_vat: number;
  created_at: string;
  updated_at: string;
}

export interface ExecutionRecordData {
  project_name?: string;
  author?: string;
  date?: string;
  process?: string;
  item_name?: string;
  material_cost?: number;
  labor_cost?: number;
  vat_amount?: number;
  total_amount?: number;
  notes?: string;
  images?: string[];
  payment_id?: string;
  includes_tax_deduction?: boolean;
  includes_vat?: boolean;
}

// Firebase Firestore 전용 서비스
const executionRecordService = {
  getAllRecords: (): Promise<ExecutionRecordResponse[]> => {
    return executionRecordFirestoreService.getAllRecords();
  },

  getRecordById: async (id: string): Promise<ExecutionRecordResponse> => {
    const result = await executionRecordFirestoreService.getRecordById(id);
    if (!result) throw new Error('Execution record not found');
    return result;
  },

  createRecord: (data: ExecutionRecordData): Promise<ExecutionRecordResponse> => {
    return executionRecordFirestoreService.createRecord(data as unknown as Record<string, unknown>);
  },

  updateRecord: (id: string, data: Partial<ExecutionRecordData>): Promise<ExecutionRecordResponse> => {
    return executionRecordFirestoreService.updateRecord(id, data as unknown as Record<string, unknown>);
  },

  deleteRecord: (id: string): Promise<void> => {
    return executionRecordFirestoreService.deleteRecord(id);
  },

  // Firestore 실시간 구독
  subscribeToRecords: executionRecordFirestoreService.subscribeToRecords,
  getRecordsByProject: executionRecordFirestoreService.getRecordsByProject,
  getRecordByPaymentId: executionRecordFirestoreService.getRecordByPaymentId
};

export default executionRecordService;
