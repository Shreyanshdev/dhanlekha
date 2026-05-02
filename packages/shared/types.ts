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
  name: string;
  email: string;
  role: 'admin' | 'cashier';
  created_at: string;
}

export interface JwtPayload {
  userId: string;
  tenantId: string;
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
  prefix: string;
  next_number: number;
  created_at: string;
  updated_at: string;
}

// ─── Products & Inventory (Sprint 3+) ───

export interface Product {
  id: string;
  tenant_id: string;
  name: string;
  barcode: string;
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
}

// ─── Billing (Sprint 5+) ───

export interface Invoice {
  id: string;
  tenant_id: string;
  customer_id: string | null;
  total_amount: number;
  status: 'draft' | 'paid' | 'cancelled';
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
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
