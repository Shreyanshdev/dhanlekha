import express from 'express';
import cors from 'cors';
import helmet from 'helmet';

// Middleware
import requestLogger from './middleware/requestLogger.middleware';
import errorHandler from './middleware/errorHandler.middleware';

// Routes
import healthRoutes from './modules/health/health.routes';

const app = express();

// ── Security ──
app.use(helmet());
app.use(cors());

// ── Body Parsing ──
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ── Request Logging ──
app.use(requestLogger);

// ── API Routes ──
app.use('/api/v1/health', healthRoutes);

// ── 404 Handler ──
app.use((_req, res) => {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: 'Endpoint not found',
    },
  });
});

// ── Global Error Handler (must be last) ──
app.use(errorHandler);

export default app;
