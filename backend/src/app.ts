import 'reflect-metadata';
import dotenv from 'dotenv';

// Load environment variables before any other imports that may depend on them
dotenv.config();

import path from 'path';
import express from 'express';
import cors from 'cors';
import authRoutes from './routes/authRoutes';
import productRoutes from './routes/productRoutes';
import btuFactorRoutes from './routes/btuFactorRoutes';
import serviceTypeRoutes from './routes/serviceTypeRoutes';
import brandRoutes from './routes/brandRoutes';
import serviceRequestRoutes from './routes/serviceRequestRoutes';
import aiRoutes from './routes/aiRoutes';
import scheduleRoutes from './routes/scheduleRoutes';
import quotationRoutes from './routes/quotationRoutes';
import reportRoutes from './routes/reportRoutes';
import adminRoutes from './routes/adminRoutes';
import internalRoutes from './routes/internalRoutes';
import { expireStaleReschedules } from './services/rescheduleService';
import { errorMiddleware } from './middlewares/errorMiddleware';
import { publicRateLimiter } from './middlewares/rateLimitMiddleware';

const app = express();
const PORT = process.env.PORT || 3000;

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
app.use('/api/quotations', quotationRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/admin', adminRoutes);

// Internal, scheduler-only routes (self-guarded by INTERNAL_CRON_SECRET).
app.use('/api/internal', internalRoutes);

// Global error handling middleware (must be registered after all routes)
app.use(errorMiddleware);

// Initialize database connection
const initDb = async () => {
  try {
    const { default: sequelize } = await import('./database/connection');
    await sequelize.authenticate();
    console.log('Database connection established.');
  } catch (err) {
    console.error('Unable to connect to database:', err);
  }
};

/**
 * How often the long-lived server sweeps expired reschedule proposals.
 *
 * A ~30s cadence keeps a proposal's visible status within the 60s bound of its
 * expiry (Req 10.6) even when no read path happens to run. The sweep calls the
 * same idempotent `expireStaleReschedules` as the lazy read paths and the
 * internal cron endpoint, so extra runs touch zero already-expired rows
 * (Req 10.7). This timer only exists on the always-on server; the serverless
 * (Vercel) deployment relies on Vercel Cron hitting
 * POST /api/internal/expire-reschedules instead.
 */
const RESCHEDULE_SWEEP_INTERVAL_MS = 30_000;

function startRescheduleExpirySweep(): void {
  const timer = setInterval(() => {
    void expireStaleReschedules().catch((err) => {
      console.error('Reschedule expiry sweep failed:', err);
    });
  }, RESCHEDULE_SWEEP_INTERVAL_MS);
  // Don't keep the process alive solely for this timer.
  timer.unref();
}

// Start server only in non-serverless environments
if (process.env.VERCEL !== '1') {
  initDb().then(() => {
    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });
    startRescheduleExpirySweep();
  });
} else if (process.env.DATABASE_URL || process.env.DB_HOST) {
  // On Vercel, only connect to DB if configured
  initDb();
}

export default app;
