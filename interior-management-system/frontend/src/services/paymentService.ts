import api from './api';
import paymentFirestoreService from './firestore/paymentFirestoreService';

export interface PaymentData {
  projectId: string;
  purpose: string;
  process?: string;
  itemName?: string;
  amount: number;
  category: 'material' | 'labor' | 'equipment' | 'transport' | 'other';
  urgency?: 'normal' | 'urgent' | 'emergency';
  requestedBy?: string;
  bankInfo?: {
    accountHolder: string;
    bankName: string;
    accountNumber: string;
  };
  notes?: string;
  attachments?: File[];
  materialAmount?: number;
  laborAmount?: number;
  originalMaterialAmount?: number;
  originalLaborAmount?: number;
  applyTaxDeduction?: boolean;
  includesVAT?: boolean;
  quickText?: string;
  images?: string[];
}

export interface PaymentResponse {
  id: number;
  project_id: number;
  project_name: string;
  project_color: string;
  user_id: number;
  requester_name: string;
  approver_name?: string;
  approved_by?: number;
  request_type: string;
  vendor_name: string;
  description: string;
  amount: number;
  account_holder: string;
  bank_name: string;
  account_number: string;
  item_name?: string;
  material_amount?: number;
  labor_amount?: number;
  original_material_amount?: number;
  original_labor_amount?: number;
  apply_tax_deduction?: number;
  includes_vat?: number;
  quick_text?: string;
  images?: string;
  notes: string;
  status: 'pending' | 'reviewing' | 'approved' | 'on-hold' | 'rejected' | 'completed';
  created_at: string;
  updated_at: string;
  approved_at?: string;
  paid_at?: string;
}

// Firebase Firestore 전용 서비스
const paymentService = {
  getAllPayments: (): Promise<PaymentResponse[]> => {
    return paymentFirestoreService.getAllPayments();
  },

  getPaymentById: async (id: string): Promise<PaymentResponse> => {
    const result = await paymentFirestoreService.getPaymentById(id);
    if (!result) throw new Error('Payment not found');
    return result;
  },

  createPayment: (data: PaymentData): Promise<PaymentResponse> => {
    return paymentFirestoreService.createPayment(data as unknown as Record<string, unknown>);
  },

  updatePayment: (id: string, data: Partial<PaymentData>): Promise<PaymentResponse> => {
    return paymentFirestoreService.updatePayment(id, data as unknown as Record<string, unknown>);
  },

  updatePaymentStatus: (id: string, status: string): Promise<PaymentResponse> => {
    return paymentFirestoreService.updatePaymentStatus(id, status);
  },

  updatePaymentAmounts: (id: string, materialAmount: number, laborAmount: number): Promise<PaymentResponse> => {
    return paymentFirestoreService.updatePaymentAmounts(id, materialAmount, laborAmount);
  },

  updatePaymentImages: (id: string, images: string[]): Promise<{ message: string; images: string[] }> => {
    return paymentFirestoreService.updatePaymentImages(id, images);
  },

  deletePayment: (id: string): Promise<void> => {
    return paymentFirestoreService.deletePayment(id);
  },

  // Toss 결제 SMS 발송 (외부 API 호출)
  sendTossPaymentSms: async (data: {
    recipientPhone: string;
    accountHolder: string;
    bankName: string;
    accountNumber: string;
    amount: number;
    projectName: string;
    itemName?: string;
    process?: string;
    paymentId?: string | number;
  }): Promise<{ success: boolean; message?: string }> => {
    const response = await api.post('/payments/send-toss-payment-sms', data);
    return response.data;
  },

  // Firestore 실시간 구독
  subscribeToPayments: paymentFirestoreService.subscribeToPayments,
  getPaymentsByProject: paymentFirestoreService.getPaymentsByProject,
  clearProjectsCache: paymentFirestoreService.clearProjectsCache
};

export default paymentService;
