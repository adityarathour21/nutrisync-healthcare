import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { securitySanitizer } from './middleware/auth.js';
import { authRouter } from './routes/authRoutes.js';
import { catalogueRouter } from './routes/catalogueRoutes.js';
import { patientRouter } from './routes/patientRoutes.js';
import { aiRouter } from './routes/aiRoutes.js';
import { clinicalRouter } from './routes/clinicalRoutes.js';
import { orderPaymentRouter } from './routes/orderPaymentRoutes.js';
import { operationsRouter } from './routes/operationsRoutes.js';
import { dbStore } from './config/store.js';

export function createExpressApp() {
  const app = express();

  app.set('trust proxy', 1);

  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false,
    })
  );

  app.use(
    cors({
      origin: true,
      credentials: true,
    })
  );

  app.use(express.json({ limit: '6mb' }));
  app.use(cookieParser());
  app.use(securitySanitizer);

  const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 600,
    standardHeaders: true,
    legacyHeaders: false,
  });

  app.use('/api', apiLimiter);

  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'ok',
      platform: 'NutriSync Clinical Nutrition API',
      databaseMode: dbStore.mongoConnected ? 'mongodb_atlas' : 'persistent_local_store',
    });
  });

  app.use('/api/auth', authRouter);
  app.use('/api', catalogueRouter);
  app.use('/api/patient', patientRouter);
  app.use('/api/ai', aiRouter);
  app.use('/api/dietitian', clinicalRouter);
  app.use('/api', orderPaymentRouter);
  app.use('/api', operationsRouter);

  return app;
}
