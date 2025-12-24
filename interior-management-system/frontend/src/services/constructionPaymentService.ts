import api from './api';
import constructionPaymentFirestoreService from './firestore/constructionPaymentFirestoreService';
import { getDataSourceConfig } from './firestore/dataSourceConfig';

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

// Railway API 서비스 (기존)
const railwayConstructionPaymentService = {
  getAllConstructionPayments: async (): Promise<ConstructionPaymentResponse[]> => {
    const response = await api.get('/construction-payments');
    return response.data;
  },

  getConstructionPaymentById: async (id: string): Promise<ConstructionPaymentResponse> => {
    const response = await api.get(`/construction-payments/${id}`);
    return response.data;
  },

  createConstructionPayment: async (data: ConstructionPaymentData): Promise<ConstructionPaymentResponse> => {
    const response = await api.post('/construction-payments', data);
    return response.data;
  },

  updateConstructionPayment: async (id: string, data: Partial<ConstructionPaymentData>): Promise<ConstructionPaymentResponse> => {
    const response = await api.put(`/construction-payments/${id}`, data);
    return response.data;
  },

  deleteConstructionPayment: async (id: string): Promise<void> => {
    await api.delete(`/construction-payments/${id}`);
  }
};

// 통합 서비스 (데이터 소스에 따라 자동 선택)
const constructionPaymentService = {
  getAllConstructionPayments: async (): Promise<ConstructionPaymentResponse[]> => {
    if (getDataSourceConfig()) {
      console.log('[constructionPaymentService] Using Firestore');
      return constructionPaymentFirestoreService.getAllConstructionPayments();
    }
    console.log('[constructionPaymentService] Using Railway API');
    return railwayConstructionPaymentService.getAllConstructionPayments();
  },

  getConstructionPaymentById: async (id: string): Promise<ConstructionPaymentResponse> => {
    if (getDataSourceConfig()) {
      const result = await constructionPaymentFirestoreService.getConstructionPaymentById(id);
      if (!result) throw new Error('Construction payment not found');
      return result;
    }
    return railwayConstructionPaymentService.getConstructionPaymentById(id);
  },

  createConstructionPayment: async (data: ConstructionPaymentData): Promise<ConstructionPaymentResponse> => {
    if (getDataSourceConfig()) {
      return constructionPaymentFirestoreService.createConstructionPayment(data);
    }
    return railwayConstructionPaymentService.createConstructionPayment(data);
  },

  updateConstructionPayment: async (id: string, data: Partial<ConstructionPaymentData>): Promise<ConstructionPaymentResponse> => {
    if (getDataSourceConfig()) {
      return constructionPaymentFirestoreService.updateConstructionPayment(id, data);
    }
    return railwayConstructionPaymentService.updateConstructionPayment(id, data);
  },

  deleteConstructionPayment: async (id: string): Promise<void> => {
    if (getDataSourceConfig()) {
      return constructionPaymentFirestoreService.deleteConstructionPayment(id);
    }
    return railwayConstructionPaymentService.deleteConstructionPayment(id);
  },

  // Firestore 실시간 구독 (Firestore 전용)
  subscribeToConstructionPayments: constructionPaymentFirestoreService.subscribeToConstructionPayments
};

export default constructionPaymentService;
