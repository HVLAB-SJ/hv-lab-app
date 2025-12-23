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
  originalMaterialAmount?: number;
  originalLaborAmount?: number;
  applyTaxDeduction?: boolean;
  includesVAT?: boolean;
  quickText?: string;
  images?: string[];  // base64 이미지 배열
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
  quick_text?: string;  // 자동으로 항목 채우기에 입력했던 원본 텍스트
  images?: string;  // JSON 문자열로 저장된 이미지 배열
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
      materialAmount: data.materialAmount ?? data.amount,  // 미지정 시 전체금액을 자재비로
      laborAmount: data.laborAmount ?? 0,
      originalMaterialAmount: data.originalMaterialAmount || 0,
      originalLaborAmount: data.originalLaborAmount || 0,
      applyTaxDeduction: data.applyTaxDeduction || false,
      includesVAT: data.includesVAT || false,
      quickText: data.quickText || '',  // 원본 텍스트 추가
      images: data.images || []  // 이미지 배열 추가
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
    if (data.originalMaterialAmount !== undefined) backendData.originalMaterialAmount = data.originalMaterialAmount;
    if (data.originalLaborAmount !== undefined) backendData.originalLaborAmount = data.originalLaborAmount;
    if (data.applyTaxDeduction !== undefined) backendData.applyTaxDeduction = data.applyTaxDeduction;
    if (data.includesVAT !== undefined) backendData.includesVAT = data.includesVAT;
    if (data.notes !== undefined) backendData.notes = data.notes;
    if ((data as any).requestDate !== undefined) backendData.requestDate = (data as any).requestDate;
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

  // Update payment amounts only (for split amounts)
  updatePaymentAmounts: async (id: string, materialAmount: number, laborAmount: number): Promise<PaymentResponse> => {
    const response = await api.patch(`/payments/${id}/amounts`, { materialAmount, laborAmount });
    return response.data;
  },

  // Update payment images
  updatePaymentImages: async (id: string, images: string[]): Promise<{ message: string; images: string[] }> => {
    const response = await api.put(`/payments/${id}/images`, { images });
    return response.data;
  },

  // Delete payment
  deletePayment: async (id: string): Promise<void> => {
    await api.delete(`/payments/${id}`);
  }
};

export default paymentService;
