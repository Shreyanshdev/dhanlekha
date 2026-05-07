// ─── Shared TypeScript Interfaces ───
// Single source of truth for all entity types across the monorepo.
// These match the database schema exactly (snake_case column names).

// ─── SaaS & Multi-Tenancy ───

export interface Tenant {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  plan_id: string;
  status: 'active' | 'suspended' | 'cancelled';
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
}

export interface Branch {
  id: string;
  tenant_id: string;
  name: string;
  address: string | null;
  phone: string | null;
  is_active: boolean;
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
}

export interface Plan {
  id: string;
  name: string;
  monthly_price: number; // In paise (₹999.00 = 99900)
  created_at: string;
  updated_at: string;
}

// ─── Users & Auth ───

export interface User {
  id: string;
  tenant_id: string;
  branch_id: string | null;
  name: string;
  email: string;
  password_hash: string;
  role: 'admin' | 'cashier';
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
}

/** Safe subset of User — never expose password_hash outside the service layer */
export interface UserPublic {
  id: string;
  tenant_id: string;
  branch_id: string | null;
  name: string;
  email: string;
  role: 'admin' | 'cashier';
  created_at: string;
}

export interface JwtPayload {
  userId: string;
  tenantId: string;
  branchId: string | null;
  role: 'admin' | 'cashier';
}

// ─── Settings ───

export interface Setting {
  id: string;
  tenant_id: string;
  key: string;
  value: string;
  created_at: string;
  updated_at: string;
}

// ─── Invoice Sequences ───

export interface InvoiceSequence {
  id: string;
  tenant_id: string;
  branch_id: string;
  prefix: string;
  next_number: number;
  created_at: string;
  updated_at: string;
}

// ─── Customers & Suppliers ───

export interface Customer {
  id: string;
  tenant_id: string;
  name: string;
  phone: string | null;
  address: string | null;
  credit_limit: number;
  total_due: number;
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
}

export interface Supplier {
  id: string;
  tenant_id: string;
  name: string;
  phone: string | null;
  address: string | null;
  gst_number: string | null;
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
}

export interface Product {
  id: string;
  tenant_id: string;
  name: string;
  barcode: string | null;
  gst_rate: number;          // e.g., 0, 5, 12, 18, 28
  hsn_code: string | null;
  base_unit: string;         // 'pcs', 'kg', 'ltr'
  category: string | null;
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
}

export interface Inventory {
  id: string;
  tenant_id: string;
  branch_id: string;
  product_id: string;
  total_quantity: number;    // Denormalized sum of all batches
  selling_price: number;     // In paise
  purchase_price: number;    // In paise (average or latest)
  min_stock_alert: number;
  created_at: string;
  updated_at: string;
}

export interface InventoryBatch {
  id: string;
  tenant_id: string;
  branch_id: string;
  product_id: string;
  batch_number: string;
  quantity: number;
  purchase_price: number;
  selling_price: number;
  mfg_date: string | null;
  exp_date: string | null;
  created_at: string;
  updated_at: string;
}

export interface InventoryLog {
  id: string;
  tenant_id: string;
  branch_id: string;
  product_id: string;
  batch_id: string | null;
  change_type: 'purchase' | 'sale' | 'adjustment' | 'return' | 'damage';
  quantity_change: number;   // Positive for inbound, Negative for outbound
  reference_id: string | null; // e.g., invoice_id, purchase_id
  notes: string | null;
  created_by: string;        // User ID who made the change
  created_at: string;
}

export interface Invoice {
  id: string;
  tenant_id: string;
  branch_id: string;
  customer_id: string | null;
  created_by: string | null;
  invoice_number: string;
  subtotal: number;
  tax_amount: number;
  discount_amount: number;
  final_amount: number;
  amount_paid: number;
  amount_due: number;
  status: 'paid' | 'partial' | 'unpaid' | 'cancelled';
  note: string | null;
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
}

export interface InvoiceItem {
  id: string;
  tenant_id: string;
  invoice_id: string;
  product_id: string | null;
  quantity: number;
  unit_price: number;
  gst_rate: number;
  discount_amount: number;
  offer_id: string | null;          // FK → offers.id (Sprint 10)
  total: number;
}

export interface CustomerLedger {
  id: string;
  tenant_id: string;
  customer_id: string;
  entry_type: 'invoice' | 'payment' | 'adjustment';
  reference_id: string;
  debit: number;
  credit: number;
  running_balance: number;
  notes: string | null;
  created_by: string | null;
  created_at: string;
}

// ─── Payments (Sprint 7) ───

export type PaymentMode = 'cash' | 'upi' | 'card' | 'bank_transfer' | 'cheque';
export type PaymentStatus = 'received' | 'fully_allocated' | 'partially_allocated';

export interface Payment {
  id: string;
  tenant_id: string;
  branch_id: string;
  customer_id: string | null;
  created_by: string;
  amount: number;                    // Total received, in paise
  unallocated_amount: number;        // Remaining unallocated, in paise
  payment_mode: PaymentMode;
  status: PaymentStatus;
  reference_number: string | null;   // UPI txn ID / cheque number / bank ref
  note: string | null;
  payment_date: string;              // YYYY-MM-DD local date
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
}

export interface PaymentAllocation {
  id: string;
  tenant_id: string;
  payment_id: string;
  invoice_id: string;
  allocated_amount: number;          // In paise
  created_at: string;
}

// ─── Ledger Snapshots (Sprint 8) ───

export interface LedgerSnapshot {
  id: string;
  tenant_id: string;
  customer_id: string;
  snapshot_date: string;             // YYYY-MM-DD
  closing_balance: number;           // In paise
  total_debit: number;
  total_credit: number;
  entry_count: number;
  created_at: string;
}

// ─── Purchases & Expenses (Sprint 9) ───

export type PurchaseStatus = 'pending' | 'received' | 'cancelled';
export type PurchasePaymentStatus = 'unpaid' | 'partial' | 'paid';

export interface Purchase {
  id: string;
  tenant_id: string;
  branch_id: string;
  supplier_id: string;
  purchase_number: string;
  supplier_invoice_number: string | null;
  subtotal: number;
  tax_amount: number;
  discount_amount: number;
  total_amount: number;
  paid_amount: number;
  status: PurchaseStatus;
  payment_status: PurchasePaymentStatus;
  notes: string | null;
  purchase_date: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  is_deleted: boolean;
}

export interface PurchaseItem {
  id: string;
  tenant_id: string;
  purchase_id: string;
  product_id: string;
  quantity: number;
  purchase_price: number; // Updated name
  tax_rate: number;
  tax_amount: number;
  total: number;          // Updated name
  batch_number: string | null;
  expiry_date: string | null;
}

export interface Expense {
  id: string;
  tenant_id: string;
  branch_id: string;
  category: string;
  amount: number;
  note: string | null;     // Updated name
  payment_mode: string;    // Added
  expense_date: string;
  recorded_by: string;    // Updated name
  created_at: string;
  updated_at: string;
  is_deleted: boolean;
}

// ─── Offers & Discounts (Sprint 10) ───

export type OfferType = 'flat' | 'percentage' | 'bogo' | 'bundle';
export type OfferScope = 'product' | 'category' | 'invoice' | 'customer';

export interface Offer {
  id: string;
  tenant_id: string;
  branch_id: string | null;         // NULL = all branches
  name: string;
  offer_type: OfferType;
  discount_value: number;           // Amount (flat) or percentage (percentage) or buy qty (bogo)
  applies_to: OfferScope;
  applies_to_id: string | null;     // Product/Customer UUID; NULL for invoice/category scope
  applies_to_category: string | null; // Category name when applies_to='category'
  min_purchase_amount: number;
  max_uses: number | null;          // NULL = unlimited
  used_count: number;
  buy_quantity: number | null;      // BOGO: buy N
  get_quantity: number | null;      // BOGO: get M free
  valid_from: string;               // YYYY-MM-DD
  valid_until: string;              // YYYY-MM-DD
  is_active: boolean;
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
}

// ─── Sync Engine (Sprint 11) ───

export type SyncAction = 'insert' | 'update' | 'delete';
export type ConflictStrategy = 'server_wins' | 'client_wins' | 'manual';

export interface SyncQueueEntry {
  id: string;
  tenant_id: string;
  table_name: string;
  record_id: string;
  action: SyncAction;
  version: number;
  device_id: string;
  conflict_strategy: ConflictStrategy;
  payload: Record<string, any> | null;  // Snapshot of changed data
  is_synced: boolean;
  error_message: string | null;
  created_at: string;
  synced_at: string | null;
}

export interface SyncDevice {
  id: string;
  tenant_id: string;
  device_id: string;
  device_name: string | null;
  last_version: number;
  last_seen_at: string | null;
  created_at: string;
}

// ─── Alerts (Sprint 12) ───

export type AlertType = 'low_stock' | 'payment_due' | 'high_demand' | 'expiry_soon' | 'sync_failed';

export interface Alert {
  id: string;
  tenant_id: string;
  branch_id: string | null;
  alert_type: AlertType;
  message: string;
  is_read: boolean;
  created_at: string;
}

// ─── Analytics (Sprint 13) ───

export interface DailyMetric {
  id: string;
  tenant_id: string;
  branch_id: string | null;
  date: string;
  total_sales: number;
  total_purchases: number;
  total_expenses: number;
  total_profit: number;
  invoices_count: number;
  new_customers_count: number;
  created_at: string;
}

// ─── API Response Contracts ───

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    field?: string;
  };
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
