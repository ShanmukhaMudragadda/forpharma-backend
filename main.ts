(global as any).File = class File {
  constructor(public bits: any[], public name: string, public options?: any) { }
};
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import SchemaManagementService from './src/services/SchemaManagementService.js';
import organizationRoutes from './src/routes/organizationRoutes.js';
import authRoutes from './src/routes/authRoutes.js';
import doctorRoutes from './src/routes/doctorRoutes.js';
import chemistRoutes from './src/routes/chemistRoutes.js';
import { cleanupMiddleware } from './src/middlewares/tenantMiddleware.js';
import orderRoutes from './src/routes/orderRoutes.js';
import drugRoutes from './src/routes/drugRoutes.js';
import rcpaRoutes from './src/routes/rcpaRoutes.js';
import dcrRoutes from './src/routes/dcrRoutes.js';
import sampleRoutes from './src/routes/sampleRoutes.js';
import taskPlannerRoutes from './src/routes/taskPlannerRoutes.js';
import taskRoutes from './src/routes/taskRoutes.js';
import tourPlanRoutes from './src/routes/tourPlanRoutes.js';

dotenv.config();

const app = express();
const schemaService = SchemaManagementService.getInstance();

app.use(cors({
  origin: '*', // In production, specify your app's URL
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Health check endpoint
app.get('/', (req, res) => {
  res.json({
    status: 'ok',
    message: 'ForPharma Backend API is running!',
    timestamp: new Date().toISOString()
  });
});

// Organization Routes
app.use('/api/organizations', organizationRoutes);

// Auth routes
app.use('/api/user', authRoutes);

// Doctor Routes
app.use('/api/doctors', doctorRoutes);

// Chemist routes
app.use('/api/chemists', chemistRoutes);

// Order Routes
app.use('/api/orders', orderRoutes);

// Drug Routes
app.use('/api/drugs', drugRoutes);
app.use('/uploads', express.static('uploads'));

// RCPA Routes
app.use('/api/rcpa', rcpaRoutes);

// DCR Routes
app.use('/api/dcr', dcrRoutes);

// Sample Routes
app.use('/api/samples', sampleRoutes);

// Task Planner Routes
app.use('/api/taskPlanners', taskPlannerRoutes);

// Tasks Routes
app.use('/api/tasks', taskRoutes);

// Tour Plan Routes
app.use('/api/tourPlan', tourPlanRoutes);

// 404 Not Found handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Cannot ${req.method} ${req.path}`
  });
});

// Centralized Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', err);

  if (err.code === 'P2002') {
    return res.status(409).json({
      error: 'Duplicate entry',
      field: err.meta?.target
    });
  }
  if (err.code === 'P2025') {
    return res.status(404).json({
      error: 'Record not found',
      details: err.meta?.cause || 'The requested record could not be found.'
    });
  }

  res.status(500).json({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong on the server.'
  });
});

// Use dynamic port from environment variable
const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

// Fix: Use the port variable instead of hardcoded 3000
const server = app.listen(port, '0.0.0.0', () => {
  console.log(`Server running on port ${port}`);
});

// Graceful shutdown procedures
const gracefulShutdown = async (signal: string) => {
  console.log(`\n${signal} signal received: closing HTTP server`);
  server.close(async () => {
    console.log('HTTP server closed');
    try {
      await cleanupMiddleware();
      await schemaService.closeAllConnections();
      console.log('Database connections closed.');
      process.exit(0);
    } catch (error) {
      console.error('Error during graceful shutdown:', error);
      process.exit(1);
    }
  });
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Export app for potential testing or monorepo use
export default app;