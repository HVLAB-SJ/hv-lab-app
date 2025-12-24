import constructionPaymentFirestoreService from './firestore/constructionPaymentFirestoreService';

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

// Firebase Firestore 전용 서비스
const constructionPaymentService = {
  getAllConstructionPayments: (): Promise<ConstructionPaymentResponse[]> => {
    return constructionPaymentFirestoreService.getAllConstructionPayments();
  },

  getConstructionPaymentById: async (id: string): Promise<ConstructionPaymentResponse> => {
    const result = await constructionPaymentFirestoreService.getConstructionPaymentById(id);
    if (!result) throw new Error('Construction payment not found');
    return result;
  },

  createConstructionPayment: (data: ConstructionPaymentData): Promise<ConstructionPaymentResponse> => {
    return constructionPaymentFirestoreService.createConstructionPayment(data);
  },

  updateConstructionPayment: (id: string, data: Partial<ConstructionPaymentData>): Promise<ConstructionPaymentResponse> => {
    return constructionPaymentFirestoreService.updateConstructionPayment(id, data);
  },

  deleteConstructionPayment: (id: string): Promise<void> => {
    return constructionPaymentFirestoreService.deleteConstructionPayment(id);
  },

  // Firestore 실시간 구독
  subscribeToConstructionPayments: constructionPaymentFirestoreService.subscribeToConstructionPayments
};

export default constructionPaymentService;
