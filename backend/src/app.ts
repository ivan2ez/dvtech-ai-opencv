import 'reflect-metadata';
import dotenv from 'dotenv';

// Load environment variables before any other imports that may depend on them
dotenv.config();

import express from 'express';
import cors from 'cors';
import sequelize from './database/connection';
import authRoutes from './routes/authRoutes';
import productRoutes from './routes/productRoutes';
import btuFactorRoutes from './routes/btuFactorRoutes';
import serviceTypeRoutes from './routes/serviceTypeRoutes';
import serviceRequestRoutes from './routes/serviceRequestRoutes';
import aiRoutes from './routes/aiRoutes';
import scheduleRoutes from './routes/scheduleRoutes';
import reportRoutes from './routes/reportRoutes';
import adminRoutes from './routes/adminRoutes';
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

// Health check route
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    message: 'DVTech AI Backend is running',
    timestamp: new Date().toISOString(),
  });
});

// Public routes with rate limiting
app.use('/api/auth', publicRateLimiter, authRoutes);
app.use('/api/products', publicRateLimiter, productRoutes);
app.use('/api/services', publicRateLimiter, serviceTypeRoutes);

// Protected routes (no public rate limiting needed)
app.use('/api/btu-factors', btuFactorRoutes);
app.use('/api/service-requests', serviceRequestRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/schedules', scheduleRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/admin', adminRoutes);

// Global error handling middleware (must be registered after all routes)
app.use(errorMiddleware);

// Start server
sequelize.authenticate().then(() => {
  console.log('Database connection established.');
  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
}).catch((err) => {
  console.error('Unable to connect to database:', err);
  process.exit(1);
});

export default app;
