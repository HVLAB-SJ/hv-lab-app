import { io, Socket } from 'socket.io-client';
import type {
  ScheduleUpdateData,
  PaymentRequestData,
  PaymentStatusUpdateData,
  MessageData,
  NotificationData,
  ActiveUser
} from '../types/socket';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || window.location.origin;

class SocketService {
  private socket: Socket | null = null;

  connect(token: string) {

    this.socket = io(SOCKET_URL, {
      auth: { token },
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000
    });

    this.socket.on('connect', () => {
      console.log('✅ Socket connected');
    });

    this.socket.on('disconnect', () => {
      console.log('❌ Socket disconnected');
    });

    this.socket.on('connect_error', (error) => {
      console.error('Socket connection error:', error);
    });

    return this.socket;
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  // Project room management
  joinProject(projectId: string) {
    this.socket?.emit('join:project', projectId);
  }

  leaveProject(projectId: string) {
    this.socket?.emit('leave:project', projectId);
  }

  // Schedule updates
  emitScheduleUpdate(data: ScheduleUpdateData) {
    this.socket?.emit('schedule:update', data);
  }

  onScheduleUpdated(callback: (data: ScheduleUpdateData) => void) {
    this.socket?.on('schedule:updated', callback);
  }

  // Payment notifications
  emitPaymentRequest(data: PaymentRequestData) {
    this.socket?.emit('payment:request', data);
  }

  onNewPayment(callback: (data: PaymentRequestData) => void) {
    this.socket?.on('payment:new', callback);
  }

  emitPaymentStatusUpdate(data: PaymentStatusUpdateData) {
    this.socket?.emit('payment:statusUpdate', data);
  }

  onPaymentStatusChanged(callback: (data: PaymentStatusUpdateData) => void) {
    this.socket?.on('payment:statusChanged', callback);
  }

  onPaymentUpdate(callback: (data: PaymentRequestData) => void) {
    this.socket?.on('payment:update', callback);
  }

  // Real-time chat
  sendMessage(data: MessageData) {
    this.socket?.emit('message:send', data);
  }

  onMessageReceive(callback: (data: MessageData) => void) {
    this.socket?.on('message:receive', callback);
  }

  // Notifications
  sendNotification(data: NotificationData) {
    this.socket?.emit('notification:send', data);
  }

  onNotificationReceive(callback: (data: NotificationData) => void) {
    this.socket?.on('notification:receive', callback);
  }

  // Active users
  onActiveUsers(callback: (users: ActiveUser[]) => void) {
    this.socket?.on('users:active', callback);
  }

  // Generic event listener
  on(event: string, callback: (...args: unknown[]) => void) {
    this.socket?.on(event, callback);
  }

  // Generic event emitter
  emit(event: string, data: unknown) {
    this.socket?.emit(event, data);
  }

  // Remove event listener
  off(event: string, callback?: (...args: unknown[]) => void) {
    this.socket?.off(event, callback);
  }

  // Get socket instance
  getSocket() {
    return this.socket;
  }
}

export default new SocketService();