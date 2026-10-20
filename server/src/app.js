import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { env } from './config/env.js';
import { requireAuth } from './middleware/auth.js';
import { errorHandler, notFoundHandler } from './middleware/error.js';
import authRoutes from './routes/auth.js';
import memberRoutes from './routes/members.js';
import jobRoutes from './routes/jobs.js';
import applicationRoutes from './routes/applications.js';
import eventRoutes from './routes/events.js';
import documentRoutes, { publicDocumentRouter } from './routes/documents.js';
import calendarRoutes from './routes/calendar.js';
import dashboardRoutes from './routes/dashboard.js';
import reportRoutes from './routes/reports.js';
import notificationRoutes from './routes/notifications.js';

export function createApp() {
  const app = express();
  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.use(
    cors({
      origin: (origin, cb) => cb(null, !origin || env.CLIENT_URLS.includes(origin)),
      credentials: false,
    }),
  );
  app.use(express.json({ limit: '1mb' }));
  if (env.NODE_ENV !== 'test') app.use(morgan(env.NODE_ENV === 'production' ? 'combined' : 'dev'));

  app.get('/api/health', (_req, res) => res.json({ ok: true, time: new Date().toISOString() }));

  app.use('/api/auth', authRoutes);
  app.use('/api/documents', publicDocumentRouter);

  const api = express.Router();
  api.use(requireAuth);
  api.use('/members', memberRoutes);
  api.use('/jobs', jobRoutes);
  api.use('/applications', applicationRoutes);
  api.use('/events', eventRoutes);
  api.use('/documents', documentRoutes);
  api.use('/calendar', calendarRoutes);
  api.use('/dashboard', dashboardRoutes);
  api.use('/reports', reportRoutes);
  api.use('/notifications', notificationRoutes);
  app.use('/api', api);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
