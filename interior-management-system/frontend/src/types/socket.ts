/**
 * Socket event type definitions
 */

export interface ScheduleUpdateData {
  id: string;
  title: string;
  start: Date;
  end: Date;
  project: string;
  attendees?: string[];
  description?: string;
}

export interface PaymentRequestData {
  id: string;
  project: string;
  amount: number;
  purpose: string;
  requestedBy: string;
  urgency?: 'normal' | 'urgent' | 'emergency';
}

export interface PaymentStatusUpdateData {
  paymentId: string;
  status: string;
  updatedBy: string;
}

export interface MessageData {
  id: string;
  projectId: string;
  sender: string;
  content: string;
  timestamp: Date;
}

export interface NotificationData {
  id: string;
  type: string;
  title: string;
  message: string;
  targetUserId?: string;
  timestamp: Date;
}

export interface ActiveUser {
  id: string;
  name: string;
  role: string;
  online: boolean;
}
