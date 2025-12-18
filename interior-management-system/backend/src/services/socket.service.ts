import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';

interface UserSocket {
  userId: string;
  socketId: string;
  role: string;
}

const connectedUsers: Map<string, UserSocket> = new Map();

export const initializeSocket = (io: Server): void => {
  // Authentication middleware
  io.use(async (socket: Socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      if (!token) {
        return next(new Error('Authentication failed'));
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as any;
      socket.data.userId = decoded.id;
      socket.data.role = decoded.role;
      next();
    } catch (error) {
      next(new Error('Authentication failed'));
    }
  });

  io.on('connection', (socket: Socket) => {
    console.log(`✅ User connected: ${socket.data.userId}`);

    // Store connected user
    connectedUsers.set(socket.data.userId, {
      userId: socket.data.userId,
      socketId: socket.id,
      role: socket.data.role
    });

    // Join user to their own room
    socket.join(`user:${socket.data.userId}`);

    // Join role-based rooms
    socket.join(`role:${socket.data.role}`);

    // Project room joining
    socket.on('join:project', (projectId: string) => {
      socket.join(`project:${projectId}`);
      console.log(`User ${socket.data.userId} joined project ${projectId}`);
    });

    // Leave project room
    socket.on('leave:project', (projectId: string) => {
      socket.leave(`project:${projectId}`);
      console.log(`User ${socket.data.userId} left project ${projectId}`);
    });

    // Schedule update
    socket.on('schedule:update', (data: any) => {
      socket.to(`project:${data.projectId}`).emit('schedule:updated', data);
    });

    // Payment request notification
    socket.on('payment:request', (data: any) => {
      // Notify managers and admins
      socket.to('role:admin').to('role:manager').emit('payment:new', data);
    });

    // Payment status update
    socket.on('payment:statusUpdate', (data: any) => {
      // Notify the requester
      socket.to(`user:${data.requesterId}`).emit('payment:statusChanged', data);
      // Notify project members
      socket.to(`project:${data.projectId}`).emit('payment:update', data);
    });

    // Payment refresh - 모든 클라이언트에 브로드캐스트
    socket.on('payment:refresh', (data?: any) => {
      console.log('🔄 [Socket] payment:refresh 브로드캐스트 요청:', socket.data.userId);
      // 자신을 제외한 모든 클라이언트에게 브로드캐스트
      socket.broadcast.emit('payment:refresh', {
        paymentId: data?.paymentId,
        status: data?.status,
        updatedAt: new Date().toISOString(),
        updatedBy: socket.data.userId
      });
    });

    // Real-time chat for project
    socket.on('message:send', (data: any) => {
      socket.to(`project:${data.projectId}`).emit('message:receive', {
        ...data,
        userId: socket.data.userId,
        timestamp: new Date()
      });
    });

    // Notification broadcast
    socket.on('notification:send', (data: any) => {
      if (data.targetType === 'user') {
        socket.to(`user:${data.targetId}`).emit('notification:receive', data);
      } else if (data.targetType === 'project') {
        socket.to(`project:${data.targetId}`).emit('notification:receive', data);
      } else if (data.targetType === 'role') {
        socket.to(`role:${data.targetId}`).emit('notification:receive', data);
      }
    });

    // Handle disconnect
    socket.on('disconnect', () => {
      console.log(`❌ User disconnected: ${socket.data.userId}`);
      connectedUsers.delete(socket.data.userId);
    });
  });

  // Emit active users every 30 seconds
  setInterval(() => {
    const activeUsers = Array.from(connectedUsers.values());
    io.emit('users:active', activeUsers);
  }, 30000);
};

// Utility function to emit events from outside socket handlers
export const emitToUser = (io: Server, userId: string, event: string, data: any): void => {
  io.to(`user:${userId}`).emit(event, data);
};

export const emitToProject = (io: Server, projectId: string, event: string, data: any): void => {
  io.to(`project:${projectId}`).emit(event, data);
};

export const emitToRole = (io: Server, role: string, event: string, data: any): void => {
  io.to(`role:${role}`).emit(event, data);
};

export const getConnectedUsers = (): UserSocket[] => {
  return Array.from(connectedUsers.values());
};

// 긴급 결제 알림 전체 브로드캐스트
export const emitUrgentPayment = (io: Server, data: {
  project: string;
  amount: number;
  urgency: 'urgent' | 'emergency'
}): void => {
  io.emit('urgent-payment', data);
  console.log('🚨 긴급 결제 알림 브로드캐스트:', data);
};