/**
 * Environment configuration
 * Centralized access to environment variables
 */

export const config = {
  // Server
  port: process.env.PORT || '5000',
  nodeEnv: process.env.NODE_ENV || 'development',

  // Database
  mongodbUri: process.env.MONGODB_URI || '',

  // JWT
  jwtSecret: process.env.JWT_SECRET || 'your_super_secret_jwt_key',
  jwtExpire: process.env.JWT_EXPIRE || '7d',

  // CORS
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',

  // Notification
  notificationPhoneNumber: process.env.NOTIFICATION_PHONE_NUMBER || '',

  // CoolSMS
  coolsms: {
    apiKey: process.env.COOLSMS_API_KEY || '',
    apiSecret: process.env.COOLSMS_API_SECRET || '',
    fromNumber: process.env.COOLSMS_FROM_NUMBER || ''
  },

  // Kakao
  kakao: {
    restApiKey: process.env.KAKAO_REST_API_KEY || '',
    adminKey: process.env.KAKAO_ADMIN_KEY || '',
    accessToken: process.env.KAKAO_ACCESS_TOKEN || ''
  }
};

// Log configuration on startup
console.log('📦 Configuration loaded:');
console.log('  - NODE_ENV:', config.nodeEnv);
console.log('  - PORT:', config.port);
console.log('  - NOTIFICATION_PHONE:', config.notificationPhoneNumber ? '✓' : '✗');
console.log('  - COOLSMS_API_KEY:', config.coolsms.apiKey ? '✓' : '✗');
console.log('  - COOLSMS_API_SECRET:', config.coolsms.apiSecret ? '✓' : '✗');
