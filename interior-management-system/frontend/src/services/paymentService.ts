import api from './api';

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
  originalLaborAmount?: number;
  applyTaxDeduction?: boolean;
  includesVAT?: boolean;
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
  original_labor_amount?: number;
  apply_tax_deduction?: number;
  includes_vat?: number;
  notes: string;
  status: 'pending' | 'reviewing' | 'approved' | 'on-hold' | 'rejected' | 'completed';
  created_at: string;
  updated_at: string;
  approved_at?: string;
  paid_at?: string;
}

const paymentService = {
  // Get all payments
  getAllPayments: async (): Promise<PaymentResponse[]> => {
    const response = await api.get('/payments');
    return response.data;
  },

  // Get single payment
  getPaymentById: async (id: string): Promise<PaymentResponse> => {
    const response = await api.get(`/payments/${id}`);
    return response.data;
  },

  // Create payment
  createPayment: async (data: PaymentData): Promise<PaymentResponse> => {
    // Convert to backend format (camelCase -> snake_case)
    const requestData = {
      project_id: data.projectId,
      request_type: data.category,
      vendor_name: data.process || '',
      description: data.purpose || '',  // Ensure empty string instead of undefined
      amount: data.amount,
      account_holder: data.bankInfo?.accountHolder || '',
      bank_name: data.bankInfo?.bankName || '',
      account_number: data.bankInfo?.accountNumber || '',
      notes: data.notes || '',
      itemName: data.itemName || '',
      materialAmount: data.materialAmount || 0,
      laborAmount: data.laborAmount || 0,
      originalLaborAmount: data.originalLaborAmount || 0,
      applyTaxDeduction: data.applyTaxDeduction || false,
      includesVAT: data.includesVAT || false,
      quickText: (data as any).quickText || ''  // 원본 텍스트 추가
    };
    console.log('[paymentService.createPayment] Sending to backend:', requestData);
    const response = await api.post('/payments', requestData);
    return response.data;
  },

  // Update payment
  updatePayment: async (id: string, data: Partial<PaymentData>): Promise<PaymentResponse> => {
    // Convert to backend format (camelCase -> snake_case)
    const backendData: Record<string, unknown> = {};
    if ((data as any).projectId !== undefined) backendData.project = (data as any).projectId;
    if (data.purpose !== undefined) backendData.description = data.purpose;
    if (data.amount !== undefined) backendData.amount = data.amount;
    if (data.process !== undefined) backendData.vendor_name = data.process;
    if (data.category !== undefined) backendData.request_type = data.category;
    if (data.itemName !== undefined) backendData.itemName = data.itemName;
    if (data.materialAmount !== undefined) backendData.materialAmount = data.materialAmount;
    if (data.laborAmount !== undefined) backendData.laborAmount = data.laborAmount;
    if (data.originalLaborAmount !== undefined) backendData.originalLaborAmount = data.originalLaborAmount;
    if (data.applyTaxDeduction !== undefined) backendData.applyTaxDeduction = data.applyTaxDeduction;
    if (data.includesVAT !== undefined) backendData.includesVAT = data.includesVAT;
    if (data.notes !== undefined) backendData.notes = data.notes;
    if (data.bankInfo !== undefined) {
      if (data.bankInfo.accountHolder) backendData.account_holder = data.bankInfo.accountHolder;
      if (data.bankInfo.bankName) backendData.bank_name = data.bankInfo.bankName;
      if (data.bankInfo.accountNumber) backendData.account_number = data.bankInfo.accountNumber;
    }
    const response = await api.put(`/payments/${id}`, backendData);
    return response.data;
  },

  // Update payment status
  updatePaymentStatus: async (id: string, status: string): Promise<PaymentResponse> => {
    const response = await api.put(`/payments/${id}/status`, { status });
    return response.data;
  },

  // Delete payment
  deletePayment: async (id: string): Promise<void> => {
    await api.delete(`/payments/${id}`);
  }
};

export default paymentService;
