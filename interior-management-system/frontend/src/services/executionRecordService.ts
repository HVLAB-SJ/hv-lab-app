import api from './api';
import executionRecordFirestoreService from './firestore/executionRecordFirestoreService';
import { getDataSourceConfig } from './firestore/dataSourceConfig';

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

// Railway API 서비스 (기존)
const railwayExecutionRecordService = {
  getAllRecords: async (): Promise<ExecutionRecordResponse[]> => {
    const response = await api.get('/execution-records');
    return response.data;
  },

  getRecordById: async (id: string): Promise<ExecutionRecordResponse> => {
    const response = await api.get(`/execution-records/${id}`);
    return response.data;
  },

  createRecord: async (data: ExecutionRecordData): Promise<ExecutionRecordResponse> => {
    console.log('[executionRecordService.createRecord] Creating:', data);
    const response = await api.post('/execution-records', data);
    return response.data;
  },

  updateRecord: async (id: string, data: Partial<ExecutionRecordData>): Promise<ExecutionRecordResponse> => {
    const response = await api.put(`/execution-records/${id}`, data);
    return response.data;
  },

  deleteRecord: async (id: string): Promise<void> => {
    await api.delete(`/execution-records/${id}`);
  }
};

// 통합 서비스 (데이터 소스에 따라 자동 선택)
const executionRecordService = {
  getAllRecords: async (): Promise<ExecutionRecordResponse[]> => {
    if (getDataSourceConfig()) {
      console.log('[executionRecordService] Using Firestore');
      return executionRecordFirestoreService.getAllRecords();
    }
    console.log('[executionRecordService] Using Railway API');
    return railwayExecutionRecordService.getAllRecords();
  },

  getRecordById: async (id: string): Promise<ExecutionRecordResponse> => {
    if (getDataSourceConfig()) {
      const result = await executionRecordFirestoreService.getRecordById(id);
      if (!result) throw new Error('Execution record not found');
      return result;
    }
    return railwayExecutionRecordService.getRecordById(id);
  },

  createRecord: async (data: ExecutionRecordData): Promise<ExecutionRecordResponse> => {
    if (getDataSourceConfig()) {
      return executionRecordFirestoreService.createRecord(data as unknown as Record<string, unknown>);
    }
    return railwayExecutionRecordService.createRecord(data);
  },

  updateRecord: async (id: string, data: Partial<ExecutionRecordData>): Promise<ExecutionRecordResponse> => {
    if (getDataSourceConfig()) {
      return executionRecordFirestoreService.updateRecord(id, data as unknown as Record<string, unknown>);
    }
    return railwayExecutionRecordService.updateRecord(id, data);
  },

  deleteRecord: async (id: string): Promise<void> => {
    if (getDataSourceConfig()) {
      return executionRecordFirestoreService.deleteRecord(id);
    }
    return railwayExecutionRecordService.deleteRecord(id);
  },

  // Firestore 실시간 구독 (Firestore 전용)
  subscribeToRecords: executionRecordFirestoreService.subscribeToRecords,
  getRecordsByProject: executionRecordFirestoreService.getRecordsByProject,
  getRecordByPaymentId: executionRecordFirestoreService.getRecordByPaymentId
};

export default executionRecordService;
