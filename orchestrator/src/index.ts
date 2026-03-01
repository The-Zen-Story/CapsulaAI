import express from 'express';
import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
import { initMinio } from './config/minio';
import uploadRoutes from './routes/upload';
import capsuleRoutes from './routes/capsule';
import searchRoutes from './routes/search';
import ingestRoutes from './routes/ingest';
import timelineRoutes from './routes/timeline';
import entitiesRoutes from './routes/entities';
import researchRoutes from './routes/research';
import feedbackRoutes from './routes/feedback';
import settingsRoutes from './routes/settings';
import graphRoutes from './routes/graph';
import reviewRoutes from './routes/review';
import maintenanceRoutes from './routes/maintenance';
import healthRoutes from './routes/health';
import cors from 'cors';
import { initializeMaintenanceJobs } from './jobs/maintenance.jobs';

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;
const prisma = new PrismaClient();

app.use(express.json());
app.use(cors());

// Routes
app.use('/api/uploads', uploadRoutes);
app.use('/api/capsules', capsuleRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/ingest', ingestRoutes);
app.use('/api/timeline', timelineRoutes);
app.use('/api/entities', entitiesRoutes);
app.use('/api/research', researchRoutes);
app.use('/api/feedback', feedbackRoutes);
app.use('/api/graph', graphRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/review', reviewRoutes);
app.use('/api/maintenance', maintenanceRoutes);
app.use('/api/health', healthRoutes);

// Health check
app.get('/health', async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: 'ok', db: 'connected' });
  } catch (error) {
    console.error('Health check failed:', error);
    res.status(500).json({ status: 'error', db: 'disconnected' });
  }
});

// Initialize services and start server
import { startWorker } from './worker';

const startServer = async () => {
  await initMinio();

  // AI Capability Check
  if (process.env.LOCAL_MODEL_ENDPOINT) {
    console.log('--- AI Startup Check ---');
    console.log('[Local] Endpoint:', process.env.LOCAL_MODEL_ENDPOINT);
  }
  if (process.env.CLOUD_MODEL_ENDPOINT) {
    console.log('[Cloud] Endpoint:', process.env.CLOUD_MODEL_ENDPOINT);
  }

  startWorker();

  // Initialize maintenance jobs scheduler
  initializeMaintenanceJobs();

  app.listen(port, () => {
    console.log(`Orchestrator running at http://localhost:${port}`);
  });
};

startServer();
