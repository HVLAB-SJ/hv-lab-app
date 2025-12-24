import api from './api';
import quoteInquiryFirestoreService from './firestore/quoteInquiryFirestoreService';
import { getDataSourceConfig } from './firestore/dataSourceConfig';

export interface QuoteInquiry {
  id: string;
  name: string;
  phone: string;
  email: string;
  address?: string;
  projectType?: string;
  budget?: string;
  message: string;
  createdAt: string;
  isRead: boolean;
}

// Railway API 서비스 (기존)
const railwayQuoteInquiryService = {
  getAllQuoteInquiries: async (): Promise<QuoteInquiry[]> => {
    const response = await api.get('/quote-inquiries');
    return response.data;
  },

  markAsRead: async (id: string): Promise<void> => {
    await api.put(`/quote-inquiries/${id}/read`);
  },

  deleteQuoteInquiry: async (id: string): Promise<void> => {
    await api.delete(`/quote-inquiries/${id}`);
  }
};

// 통합 서비스 (데이터 소스에 따라 자동 선택)
const quoteInquiryService = {
  getAllQuoteInquiries: async (): Promise<QuoteInquiry[]> => {
    if (getDataSourceConfig()) {
      console.log('[quoteInquiryService] Using Firestore');
      return quoteInquiryFirestoreService.getAllQuoteInquiries();
    }
    console.log('[quoteInquiryService] Using Railway API');
    return railwayQuoteInquiryService.getAllQuoteInquiries();
  },

  markAsRead: async (id: string): Promise<void> => {
    if (getDataSourceConfig()) {
      return quoteInquiryFirestoreService.markAsRead(id);
    }
    return railwayQuoteInquiryService.markAsRead(id);
  },

  deleteQuoteInquiry: async (id: string): Promise<void> => {
    if (getDataSourceConfig()) {
      return quoteInquiryFirestoreService.deleteQuoteInquiry(id);
    }
    return railwayQuoteInquiryService.deleteQuoteInquiry(id);
  },

  // Firestore 실시간 구독 (Firestore 전용)
  subscribeToQuoteInquiries: quoteInquiryFirestoreService.subscribeToQuoteInquiries
};

export default quoteInquiryService;
