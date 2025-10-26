/**
 * Form data type definitions
 */

export interface Contractor {
  id: string;
  _id?: string;
  rank: number;
  companyName: string;
  name: string;
  process: string;
  contact: string;
  accountNumber: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface PaymentRequestFormData {
  projectId: string;
  purpose: string;
  process: string;
  itemName: string;
  amount: number;
  materialAmount?: number;
  laborAmount?: number;
  originalMaterialAmount?: number;
  originalLaborAmount?: number;
  applyTaxDeduction?: boolean;
  includesVAT?: boolean;
  category: string;
  urgency: 'normal' | 'urgent' | 'emergency';
  requestedBy: string;
  accountHolder: string;
  bankName: string;
  accountNumber: string;
  notes?: string;
  attachments?: File[];
}

export interface WorkRequestFormData {
  project: string;
  requestType: string;
  requestDate: Date;
  dueDate: Date;
  requestedBy: string;
  assignedTo: string;
  description: string;
  status?: string;
  priority?: string;
  completedDate?: Date;
}

export interface ApiError {
  response?: {
    data?: {
      message?: string;
    };
  };
  message?: string;
}

export interface AdditionalWorkFormData {
  project: string;
  date: Date;
  description: string;
  amount: number;
  category?: string;
  notes?: string;
}

export interface ASRequestFormData {
  project: string;
  description: string;
  status: string;
  requestDate: Date;
  scheduledVisitDate?: Date | null;
  scheduledVisitTime?: string;
  completedDate?: Date | null;
  assignedTo?: string[];
  priority?: string;
  notes?: string;
}

export interface ConstructionPaymentData {
  project: string;
  totalAmount: number;
  vatType: 'percentage' | 'fixed';
  vatPercentage: number;
  vatAmount: number;
  expectedPaymentDates?: {
    contract?: Date;
    start?: Date;
    middle?: Date;
    final?: Date;
  };
  payments: PaymentRecord[];
}

export interface PaymentRecord {
  id: string;
  date: Date;
  amount: number;
  type?: string;
  types?: PaymentType[];
  method: string;
  notes?: string;
}

export type PaymentType = '계약금' | '착수금' | '중도금' | '잔금';
