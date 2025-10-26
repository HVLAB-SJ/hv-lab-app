import api from './api';

export interface ConstructionPaymentData {
  project: string;
  client: string;
  totalAmount: number;
  vatType: 'percentage' | 'amount';
  vatPercentage: number;
  vatAmount: number;
  payments: Array<{
    types: ('계약금' | '착수금' | '중도금' | '잔금' | '추가금')[];
    amount: number;
    date: Date;
    method: string;
    notes?: string;
  }>;
  expectedPaymentDates?: {
    contract?: Date;
    start?: Date;
    middle?: Date;
    final?: Date;
  };
}

export interface ConstructionPaymentResponse {
  _id: string;
  project: string;
  client: string;
  totalAmount: number;
  vatType: 'percentage' | 'amount';
  vatPercentage: number;
  vatAmount: number;
  payments: Array<{
    types: ('계약금' | '착수금' | '중도금' | '잔금' | '추가금')[];
    amount: number;
    date: string;
    method: string;
    notes?: string;
  }>;
  expectedPaymentDates?: {
    contract?: string;
    start?: string;
    middle?: string;
    final?: string;
  };
  createdAt: string;
  updatedAt: string;
}

const constructionPaymentService = {
  // Get all construction payments
  getAllConstructionPayments: async (): Promise<ConstructionPaymentResponse[]> => {
    const response = await api.get('/construction-payments');
    return response.data;
  },

  // Get single construction payment
  getConstructionPaymentById: async (id: string): Promise<ConstructionPaymentResponse> => {
    const response = await api.get(`/construction-payments/${id}`);
    return response.data;
  },

  // Create construction payment
  createConstructionPayment: async (data: ConstructionPaymentData): Promise<ConstructionPaymentResponse> => {
    const response = await api.post('/construction-payments', data);
    return response.data;
  },

  // Update construction payment
  updateConstructionPayment: async (id: string, data: Partial<ConstructionPaymentData>): Promise<ConstructionPaymentResponse> => {
    const response = await api.put(`/construction-payments/${id}`, data);
    return response.data;
  },

  // Delete construction payment
  deleteConstructionPayment: async (id: string): Promise<void> => {
    await api.delete(`/construction-payments/${id}`);
  }
};

export default constructionPaymentService;
