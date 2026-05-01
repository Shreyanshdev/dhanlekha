export interface Tenant {
  id: string;
  name: string;
  planId: string;
}

export interface User {
  id: string;
  tenant_id: string;
  name: string;
  email: string;
  role: 'admin' | 'cashier';
}

export interface Product {
  id: string;
  tenant_id: string;
  name: string;
  barcode: string;
}

export interface Invoice {
  id: string;
  tenant_id: string;
  customer_id: string | null;
  total_amount: number;
  status: 'draft' | 'paid' | 'cancelled';
}
