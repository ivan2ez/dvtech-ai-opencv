import 'reflect-metadata';
import dotenv from 'dotenv';

// Load environment variables before any other imports that may depend on them
dotenv.config();

import path from 'path';
import express from 'express';
import cors from 'cors';
import { errorMiddleware } from './middlewares/errorMiddleware';
import { publicRateLimiter } from './middlewares/rateLimitMiddleware';

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check route (no DB dependency)
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    message: 'DVTech AI Backend is running',
    timestamp: new Date().toISOString(),
  });
});

// Lazy-load database and routes only if DB is configured
let dbInitialized = false;
const initRoutes = async () => {
  if (dbInitialized) return;
  dbInitialized = true;

  const { default: sequelize } = await import('./database/connection');
  const { default: authRoutes } = await import('./routes/authRoutes');
  const { default: productRoutes } = await import('./routes/productRoutes');
  const { default: btuFactorRoutes } = await import('./routes/btuFactorRoutes');
  const { default: serviceTypeRoutes } = await import('./routes/serviceTypeRoutes');
  const { default: brandRoutes } = await import('./routes/brandRoutes');
  const { default: serviceRequestRoutes } = await import('./routes/serviceRequestRoutes');
  const { default: aiRoutes } = await import('./routes/aiRoutes');
  const { default: scheduleRoutes } = await import('./routes/scheduleRoutes');
  const { default: reportRoutes } = await import('./routes/reportRoutes');
  const { default: adminRoutes } = await import('./routes/adminRoutes');

  // Serve uploaded files
  app.use('/uploads', express.static(path.resolve(__dirname, '../uploads')));

  // Public routes with rate limiting
  app.use('/api/auth', publicRateLimiter, authRoutes);
  app.use('/api/products', publicRateLimiter, productRoutes);
  app.use('/api/services', publicRateLimiter, serviceTypeRoutes);
  app.use('/api/brands', publicRateLimiter, brandRoutes);

  // Protected routes
  app.use('/api/btu-factors', btuFactorRoutes);
  app.use('/api/service-requests', serviceRequestRoutes);
  app.use('/api/ai', aiRoutes);
  app.use('/api/schedules', scheduleRoutes);
  app.use('/api/reports', reportRoutes);
  app.use('/api/admin', adminRoutes);

  // Connect to database
  try {
    await sequelize.authenticate();
    console.log('Database connection established.');
    if (process.env.VERCEL === '1') {
      await sequelize.sync();
      console.log('Database tables synced.');
    }
  } catch (err) {
    console.error('Unable to connect to database:', err);
  }
};

// Initialize routes if DATABASE_URL or DB_HOST is configured
if (process.env.DATABASE_URL || process.env.DB_HOST) {
  initRoutes();
}

// Global error handling middleware (must be registered after all routes)
app.use(errorMiddleware);

// Start server only in non-serverless environments
if (process.env.VERCEL !== '1') {
  initRoutes().then(() => {
    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });
  });
}

export default app;
