import api from './api';

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
  includes_tax_deduction: number; // 0 or 1
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
}

const executionRecordService = {
  // 모든 실행내역 조회
  getAllRecords: async (): Promise<ExecutionRecordResponse[]> => {
    const response = await api.get('/execution-records');
    return response.data;
  },

  // 단일 실행내역 조회
  getRecordById: async (id: string): Promise<ExecutionRecordResponse> => {
    const response = await api.get(`/execution-records/${id}`);
    return response.data;
  },

  // 실행내역 생성
  createRecord: async (data: ExecutionRecordData): Promise<ExecutionRecordResponse> => {
    console.log('[executionRecordService.createRecord] Creating:', data);
    const response = await api.post('/execution-records', data);
    return response.data;
  },

  // 실행내역 수정
  updateRecord: async (id: string, data: Partial<ExecutionRecordData>): Promise<ExecutionRecordResponse> => {
    const response = await api.put(`/execution-records/${id}`, data);
    return response.data;
  },

  // 실행내역 삭제
  deleteRecord: async (id: string): Promise<void> => {
    await api.delete(`/execution-records/${id}`);
  }
};

export default executionRecordService;
