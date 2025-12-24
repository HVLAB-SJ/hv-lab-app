import quoteInquiryFirestoreService from './firestore/quoteInquiryFirestoreService';

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

// Firebase Firestore 전용 서비스
const quoteInquiryService = {
  getAllQuoteInquiries: (): Promise<QuoteInquiry[]> => {
    return quoteInquiryFirestoreService.getAllQuoteInquiries();
  },

  markAsRead: (id: string): Promise<void> => {
    return quoteInquiryFirestoreService.markAsRead(id);
  },

  deleteQuoteInquiry: (id: string): Promise<void> => {
    return quoteInquiryFirestoreService.deleteQuoteInquiry(id);
  },

  // Firestore 실시간 구독
  subscribeToQuoteInquiries: quoteInquiryFirestoreService.subscribeToQuoteInquiries
};

export default quoteInquiryService;
