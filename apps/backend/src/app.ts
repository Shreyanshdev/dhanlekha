import express from 'express';
import cors from 'cors';
import helmet from 'helmet';

// Middleware
import requestLogger from './middleware/requestLogger.middleware';
import errorHandler from './middleware/errorHandler.middleware';
import { globalLimiter, authLimiter, heavyLimiter } from './middleware/rateLimit.middleware';
import { sanitiseInput } from './middleware/sanitise.middleware';

// Routes
import healthRoutes from './modules/health/health.routes';
import authRoutes from './modules/auth/auth.routes';
import tenantsRoutes from './modules/tenants/tenants.routes';
import usersRoutes from './modules/users/users.routes';
import productsRoutes from './modules/products/products.routes';
import branchesRoutes from './modules/branches/branches.routes';
import customersRoutes from './modules/customers/customers.routes';
import suppliersRoutes from './modules/suppliers/suppliers.routes';
import invoicesRoutes from './modules/invoices/invoices.routes';
import paymentsRoutes from './modules/payments/payments.routes';
import ledgerRoutes from './modules/ledger/ledger.routes';
import purchasesRoutes from './modules/purchases/purchases.routes';
import expensesRoutes from './modules/expenses/expenses.routes';
import offersRoutes from './modules/offers/offers.routes';
import syncRoutes from './modules/sync/sync.routes';
import alertsRoutes from './modules/alerts/alerts.routes';
import analyticsRoutes from './modules/analytics/analytics.routes';
import aiRoutes from './modules/ai/ai.routes';

const app = express();

// ── Security Hardening ──
app.use(helmet());               // Security headers (CSP, HSTS, X-Frame-Options, etc.)
app.use(cors());                  // Cross-Origin Resource Sharing
app.use(globalLimiter);           // 200 req/min per IP — global abuse prevention

// ── Body Parsing ──
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ── Input Sanitisation (after body parsing, before routes) ──
app.use(sanitiseInput);

// ── Request Logging ──
app.use(requestLogger);

// ── API Routes ──
// Health (no rate limiting — used by load balancers)
app.use('/api/v1/health', healthRoutes);

// Auth routes — strict rate limiting to prevent brute-force
app.use('/api/v1/auth', authLimiter, authRoutes);

// Standard routes
app.use('/api/v1/tenants', tenantsRoutes);
app.use('/api/v1/users', usersRoutes);
app.use('/api/v1/products', productsRoutes);
app.use('/api/v1/branches', branchesRoutes);
app.use('/api/v1/customers', customersRoutes);
app.use('/api/v1/suppliers', suppliersRoutes);

// Heavy write operations — stricter rate limiting
app.use('/api/v1/invoices', heavyLimiter, invoicesRoutes);
app.use('/api/v1/payments', heavyLimiter, paymentsRoutes);
app.use('/api/v1/purchases', heavyLimiter, purchasesRoutes);

app.use('/api/v1', ledgerRoutes);
app.use('/api/v1/expenses', expensesRoutes);
app.use('/api/v1/offers', offersRoutes);
app.use('/api/v1/sync', syncRoutes);
app.use('/api/v1/alerts', alertsRoutes);
app.use('/api/v1/analytics', analyticsRoutes);
app.use('/api/v1/ai', aiRoutes);

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
