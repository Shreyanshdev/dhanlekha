export interface Tenant {
  id: string;
  name: string;
  planId: string;
}

export interface User {
  id: string;
  tenantId: string;
  role: 'admin' | 'cashier';
}
