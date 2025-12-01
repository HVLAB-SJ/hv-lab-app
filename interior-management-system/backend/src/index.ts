import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { Server } from 'socket.io';
import path from 'path';

// Load environment variables FIRST
dotenv.config({ path: path.join(__dirname, '../.env') });

// Import config (loads env vars into config object)
import { config } from './config/env.config';

// Import database connection
import { connectDB } from './config/database';

// Import routes
import authRoutes from './routes/auth.routes';
import projectRoutes from './routes/project.routes';
import scheduleRoutes from './routes/schedule.routes';
import contractorRoutes from './routes/contractor.routes';
import paymentRoutes from './routes/payment.routes';
import notificationRoutes from './routes/notification.routes';
import userRoutes from './routes/user.routes';
import asRequestRoutes from './routes/asrequest.routes';
import constructionPaymentRoutes from './routes/constructionPayment.routes';
import workRequestRoutes from './routes/workrequest.routes';
import additionalWorkRoutes from './routes/additionalWork.routes';
import siteLogRoutes from './routes/siteLog.routes';
import drawingRoutes from './routes/drawing.routes';

// Import middleware
import { errorHandler } from './middleware/error.middleware';
import { notFound } from './middleware/notFound.middleware';

// Import socket handlers
import { initializeSocket } from './services/socket.service';

const app: Application = express();
const httpServer = createServer(app);

// Socket.IO CORS configuration
const socketAllowedOrigins: string[] = [
  'https://hvlab.app',
  'https://www.hvlab.app',
  'http://localhost:5173',
  process.env.CORS_ORIGIN || ''
].filter((origin): origin is string => Boolean(origin));

export const io = new Server(httpServer, {
  cors: {
    origin: socketAllowedOrigins,
    credentials: true
  }
});

// Connect to database
connectDB();

// Middleware
app.use(helmet());

// CORS configuration - allow multiple origins
const allowedOrigins: string[] = [
  'https://hvlab.app',
  'https://www.hvlab.app',
  'http://localhost:5173',
  process.env.CORS_ORIGIN || ''
].filter((origin): origin is string => Boolean(origin));

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);

    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.warn(`CORS blocked origin: ${origin}`);
      callback(null, false);
    }
  },
  credentials: true
}));
app.use(compression());
app.use(morgan('dev'));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Static files for uploaded images
// Railway Volume 또는 로컬 경로에서 정적 파일 서빙
const volumePath = process.env.RAILWAY_VOLUME_MOUNT_PATH;
if (volumePath) {
  // Railway Volume 사용 시 - drawings 폴더 서빙
  app.use('/uploads/drawings', express.static(path.join(volumePath, 'drawings')));
  console.log('📁 Railway Volume 정적 파일 서빙:', path.join(volumePath, 'drawings'));
}
// 로컬 uploads 폴더도 서빙 (로컬 개발용)
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/schedules', scheduleRoutes);
app.use('/api/contractors', contractorRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/users', userRoutes);
app.use('/api/as-requests', asRequestRoutes);
app.use('/api/construction-payments', constructionPaymentRoutes);
app.use('/api/workrequests', workRequestRoutes);
app.use('/api/additional-works', additionalWorkRoutes);
app.use('/api/site-logs', siteLogRoutes);
app.use('/api/drawings', drawingRoutes);

// Health check endpoint with version info
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    version: '1.0.1',
    service: 'HV LAB Interior Management API',
    uptime: process.uptime()
  });
});

// Temporary endpoint to create initial users (REMOVE IN PRODUCTION)
app.post('/api/setup/create-initial-users', async (_req, res) => {
  try {
    const User = require('./models/User.model').default;
    const users = [
      { username: '상준', name: '상준', password: '0109', role: 'admin' },
      { username: '신애', name: '신애', password: '0109', role: 'manager' },
      { username: '재천', name: '재천', password: '0109', role: 'worker' },
      { username: '민기', name: '민기', password: '0109', role: 'worker' },
      { username: '재성', name: '재성', password: '0109', role: 'worker' },
      { username: '재현', name: '재현', password: '0109', role: 'worker' }
    ];

    const createdUsers = [];
    for (const userData of users) {
      const existingUser = await User.findOne({ username: userData.username });
      if (!existingUser) {
        const user = new User(userData);
        await user.save();
        createdUsers.push(userData.username);
      }
    }

    res.json({
      message: 'Users created successfully',
      created: createdUsers,
      total: users.length
    });
  } catch (error) {
    console.error('Error creating users:', error);
    res.status(500).json({ error: 'Failed to create users' });
  }
});

// Error handling middleware
app.use(notFound);
app.use(errorHandler);

// Initialize Socket.IO
initializeSocket(io);

// Start server
const PORT = process.env.PORT || 5000;
httpServer.listen(PORT, () => {
  console.log(`🚀 Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
});