import express from 'express';
import cors from 'cors';
import helmet from 'helmet';

// Middleware
import requestLogger from './middleware/requestLogger.middleware';
import errorHandler from './middleware/errorHandler.middleware';

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
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/tenants', tenantsRoutes);
app.use('/api/v1/users', usersRoutes);
app.use('/api/v1/products', productsRoutes);
app.use('/api/v1/branches', branchesRoutes);
app.use('/api/v1/customers', customersRoutes);
app.use('/api/v1/suppliers', suppliersRoutes);
app.use('/api/v1/invoices', invoicesRoutes);
app.use('/api/v1/payments', paymentsRoutes);
app.use('/api/v1', ledgerRoutes);
app.use('/api/v1/purchases', purchasesRoutes);
app.use('/api/v1/expenses', expensesRoutes);
app.use('/api/v1/offers', offersRoutes);
app.use('/api/v1/sync', syncRoutes);
app.use('/api/v1/alerts', alertsRoutes);

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
