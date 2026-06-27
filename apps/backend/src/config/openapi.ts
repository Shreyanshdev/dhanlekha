/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * OpenAPI 3.0 specification for the DhanLekha ERP backend.
 *
 * Hand-authored to stay in lock-step with the Express routes and Zod validators.
 * Served as interactive Swagger UI at `GET /api/v1/docs` and as raw JSON at
 * `GET /api/v1/docs.json`.
 *
 * All monetary fields are integer paise (₹1 = 100 paise) per the Sprint 17
 * money-representation decision (see `utils/money.ts`).
 */

const SCHEMA = '#/components/schemas/';

function ref(name: string): any {
  return { $ref: SCHEMA + name };
}

function content(schema: any): any {
  return { 'application/json': { schema } };
}

/** Standard single-resource envelope: `{ success, data }`. */
function dataResp(description: string, schema: any): any {
  return {
    description,
    content: content({
      type: 'object',
      properties: { success: { type: 'boolean', example: true }, data: schema },
    }),
  };
}

/** Paginated list envelope: `{ success, data[], pagination }`. */
function listResp(description: string, itemSchema: any): any {
  return {
    description,
    content: content({
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        data: { type: 'array', items: itemSchema },
        pagination: ref('Pagination'),
      },
    }),
  };
}

function reqBody(schemaName: string, required = true): any {
  return { required, content: content(ref(schemaName)) };
}

function pathId(name = 'id', description = 'Resource UUID'): any {
  return { name, in: 'path', required: true, schema: { type: 'string', format: 'uuid' }, description };
}

function query(name: string, schema: any, description = ''): any {
  return { name, in: 'query', required: false, schema, description };
}

const bearer = [{ bearerAuth: [] }];

const errorResponses: any = {
  '400': { description: 'Validation error / bad request', content: content(ref('Error')) },
  '401': { description: 'Missing or invalid authentication', content: content(ref('Error')) },
  '403': { description: 'Forbidden — insufficient role or plan quota exceeded', content: content(ref('Error')) },
  '404': { description: 'Resource not found', content: content(ref('Error')) },
};

const ts = (): any => ({ type: 'string', format: 'date-time' });
const dateStr = (): any => ({ type: 'string', format: 'date', example: '2026-06-27' });
const uuid = (): any => ({ type: 'string', format: 'uuid' });
const money = (desc = 'Amount in integer paise (₹1 = 100 paise)'): any => ({ type: 'integer', description: desc });
const nullableStr = (): any => ({ type: 'string', nullable: true });

const paginationQuery: any[] = [
  query('page', { type: 'string', default: '1' }, 'Page number (1-based)'),
  query('limit', { type: 'string', default: '20' }, 'Items per page'),
];

const schemas: any = {
  // ─── Envelope / shared ───
  Error: {
    type: 'object',
    properties: {
      success: { type: 'boolean', example: false },
      error: {
        type: 'object',
        properties: {
          code: { type: 'string', example: 'VALIDATION_ERROR' },
          message: { type: 'string' },
          field: { type: 'string', nullable: true },
        },
      },
    },
  },
  Pagination: {
    type: 'object',
    properties: {
      page: { type: 'integer', example: 1 },
      limit: { type: 'integer', example: 20 },
      total: { type: 'integer', example: 42 },
      totalPages: { type: 'integer', example: 3 },
    },
  },

  // ─── Entities ───
  Tenant: {
    type: 'object',
    properties: {
      id: uuid(),
      name: { type: 'string' },
      email: { type: 'string', format: 'email' },
      phone: nullableStr(),
      plan_id: { type: 'string', example: 'starter' },
      status: { type: 'string', enum: ['active', 'suspended', 'cancelled'] },
      created_at: ts(),
      updated_at: ts(),
    },
  },
  Branch: {
    type: 'object',
    properties: {
      id: uuid(),
      tenant_id: uuid(),
      name: { type: 'string' },
      address: nullableStr(),
      phone: nullableStr(),
      is_active: { type: 'boolean' },
      created_at: ts(),
      updated_at: ts(),
    },
  },
  Plan: {
    type: 'object',
    properties: {
      id: { type: 'string', example: 'growth' },
      name: { type: 'string' },
      monthly_price: money('Monthly price in integer paise'),
      created_at: ts(),
      updated_at: ts(),
    },
  },
  Subscription: {
    type: 'object',
    properties: {
      id: uuid(),
      tenant_id: uuid(),
      plan_id: { type: 'string' },
      status: { type: 'string', enum: ['active', 'past_due', 'canceled'] },
      current_period_start: ts(),
      current_period_end: ts(),
      created_at: ts(),
      updated_at: ts(),
    },
  },
  SubscriptionOverview: {
    type: 'object',
    properties: {
      tenant_id: uuid(),
      status: { type: 'string' },
      plan: ref('Plan'),
      current_period_start: { type: 'string', nullable: true },
      current_period_end: { type: 'string', nullable: true },
      usage: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            feature_id: { type: 'string', example: 'max_invoices_per_month' },
            description: { type: 'string' },
            limit: { type: 'integer', nullable: true },
            used: { type: 'integer' },
          },
        },
      },
      available_plans: { type: 'array', items: ref('Plan') },
    },
  },
  UserPublic: {
    type: 'object',
    properties: {
      id: uuid(),
      tenant_id: uuid(),
      branch_id: { ...uuid(), nullable: true },
      name: { type: 'string' },
      email: { type: 'string', format: 'email' },
      role: { type: 'string', enum: ['admin', 'cashier'] },
      created_at: ts(),
    },
  },
  Setting: {
    type: 'object',
    description: 'Tenant key/value config. The GET/PATCH APIs use a flat key→value map.',
    additionalProperties: { type: 'string' },
    example: { invoice_prefix: 'INV', gst_number: '29ABCDE1234F1Z5' },
  },
  Customer: {
    type: 'object',
    properties: {
      id: uuid(),
      tenant_id: uuid(),
      name: { type: 'string' },
      phone: nullableStr(),
      address: nullableStr(),
      credit_limit: money('Credit limit in integer paise'),
      total_due: money('Outstanding balance in integer paise'),
      created_at: ts(),
      updated_at: ts(),
    },
  },
  Supplier: {
    type: 'object',
    properties: {
      id: uuid(),
      tenant_id: uuid(),
      name: { type: 'string' },
      phone: nullableStr(),
      address: nullableStr(),
      gst_number: nullableStr(),
      created_at: ts(),
      updated_at: ts(),
    },
  },
  Product: {
    type: 'object',
    properties: {
      id: uuid(),
      tenant_id: uuid(),
      name: { type: 'string' },
      barcode: nullableStr(),
      gst_rate: { type: 'number', example: 18 },
      hsn_code: nullableStr(),
      base_unit: { type: 'string', example: 'pcs' },
      category: nullableStr(),
      created_at: ts(),
      updated_at: ts(),
    },
  },
  Inventory: {
    type: 'object',
    properties: {
      id: uuid(),
      product_id: uuid(),
      branch_id: uuid(),
      total_quantity: { type: 'number' },
      selling_price: money('Selling price in integer paise'),
      purchase_price: money('Purchase price in integer paise'),
      min_stock_alert: { type: 'number' },
    },
  },
  Invoice: {
    type: 'object',
    properties: {
      id: uuid(),
      tenant_id: uuid(),
      branch_id: uuid(),
      customer_id: { ...uuid(), nullable: true },
      invoice_number: { type: 'string', example: 'INV-0001' },
      subtotal: money(),
      tax_amount: money(),
      discount_amount: money(),
      final_amount: money(),
      amount_paid: money(),
      amount_due: money(),
      status: { type: 'string', enum: ['paid', 'partial', 'unpaid', 'cancelled'] },
      note: nullableStr(),
      created_at: ts(),
      updated_at: ts(),
    },
  },
  InvoiceItem: {
    type: 'object',
    properties: {
      id: uuid(),
      invoice_id: uuid(),
      product_id: { ...uuid(), nullable: true },
      quantity: { type: 'number' },
      unit_price: money(),
      gst_rate: { type: 'number' },
      discount_amount: money(),
      offer_id: { ...uuid(), nullable: true },
      total: money(),
    },
  },
  CustomerLedger: {
    type: 'object',
    properties: {
      id: uuid(),
      customer_id: uuid(),
      entry_type: { type: 'string', enum: ['invoice', 'payment', 'adjustment'] },
      reference_id: { type: 'string' },
      debit: money(),
      credit: money(),
      running_balance: money(),
      notes: nullableStr(),
      created_at: ts(),
    },
  },
  Payment: {
    type: 'object',
    properties: {
      id: uuid(),
      customer_id: { ...uuid(), nullable: true },
      amount: money('Total received, in integer paise'),
      unallocated_amount: money('Remaining unallocated, in integer paise'),
      payment_mode: { type: 'string', enum: ['cash', 'upi', 'card', 'bank_transfer', 'cheque'] },
      status: { type: 'string', enum: ['received', 'fully_allocated', 'partially_allocated'] },
      reference_number: nullableStr(),
      note: nullableStr(),
      payment_date: dateStr(),
      created_at: ts(),
    },
  },
  Purchase: {
    type: 'object',
    properties: {
      id: uuid(),
      branch_id: uuid(),
      supplier_id: uuid(),
      purchase_number: { type: 'string' },
      supplier_invoice_number: nullableStr(),
      subtotal: money(),
      tax_amount: money(),
      discount_amount: money(),
      total_amount: money(),
      paid_amount: money(),
      status: { type: 'string', enum: ['pending', 'received', 'cancelled'] },
      payment_status: { type: 'string', enum: ['unpaid', 'partial', 'paid'] },
      purchase_date: dateStr(),
      created_at: ts(),
    },
  },
  Expense: {
    type: 'object',
    properties: {
      id: uuid(),
      branch_id: uuid(),
      category: { type: 'string' },
      amount: money(),
      note: nullableStr(),
      payment_mode: { type: 'string' },
      expense_date: dateStr(),
      created_at: ts(),
    },
  },
  Offer: {
    type: 'object',
    properties: {
      id: uuid(),
      branch_id: { ...uuid(), nullable: true },
      name: { type: 'string' },
      offer_type: { type: 'string', enum: ['flat', 'percentage', 'bogo', 'bundle'] },
      discount_value: { type: 'number' },
      applies_to: { type: 'string', enum: ['product', 'category', 'invoice', 'customer'] },
      applies_to_id: { ...uuid(), nullable: true },
      applies_to_category: nullableStr(),
      min_purchase_amount: money(),
      max_uses: { type: 'integer', nullable: true },
      used_count: { type: 'integer' },
      buy_quantity: { type: 'integer', nullable: true },
      get_quantity: { type: 'integer', nullable: true },
      valid_from: dateStr(),
      valid_until: dateStr(),
      is_active: { type: 'boolean' },
    },
  },
  Alert: {
    type: 'object',
    properties: {
      id: uuid(),
      branch_id: { ...uuid(), nullable: true },
      alert_type: { type: 'string', enum: ['low_stock', 'payment_due', 'high_demand', 'expiry_soon', 'sync_failed'] },
      message: { type: 'string' },
      is_read: { type: 'boolean' },
      created_at: ts(),
    },
  },
  SyncDevice: {
    type: 'object',
    properties: {
      id: uuid(),
      device_id: { type: 'string' },
      device_name: nullableStr(),
      last_version: { type: 'integer' },
      last_seen_at: { type: 'string', nullable: true },
    },
  },

  // ─── Auth ───
  AuthToken: {
    type: 'object',
    properties: {
      token: { type: 'string', description: 'JWT bearer token' },
      user: ref('UserPublic'),
    },
  },

  // ─── Request bodies ───
  RegisterRequest: {
    type: 'object',
    required: ['tenantName', 'tenantEmail', 'userName', 'password'],
    properties: {
      tenantName: { type: 'string', minLength: 2, maxLength: 100 },
      tenantEmail: { type: 'string', format: 'email' },
      phone: { type: 'string', pattern: '^[0-9]{10}$' },
      planId: { type: 'string', enum: ['starter', 'growth', 'enterprise'], default: 'starter' },
      userName: { type: 'string', minLength: 2, maxLength: 100 },
      password: { type: 'string', minLength: 6 },
    },
  },
  LoginRequest: {
    type: 'object',
    required: ['email', 'password'],
    properties: {
      email: { type: 'string', format: 'email' },
      password: { type: 'string' },
    },
  },
  UpdateTenantRequest: {
    type: 'object',
    properties: { name: { type: 'string' }, phone: { type: 'string', pattern: '^[0-9]{10}$' } },
  },
  CreateUserRequest: {
    type: 'object',
    required: ['name', 'email', 'password', 'role'],
    properties: {
      name: { type: 'string' },
      email: { type: 'string', format: 'email' },
      password: { type: 'string', minLength: 6 },
      role: { type: 'string', enum: ['admin', 'cashier'] },
      branch_id: { ...uuid(), nullable: true },
    },
  },
  UpdateUserRequest: {
    type: 'object',
    properties: {
      name: { type: 'string' },
      email: { type: 'string', format: 'email' },
      role: { type: 'string', enum: ['admin', 'cashier'] },
      branch_id: { ...uuid(), nullable: true },
    },
  },
  CreateBranchRequest: {
    type: 'object',
    required: ['name'],
    properties: { name: { type: 'string', minLength: 3 }, address: { type: 'string' }, phone: { type: 'string' } },
  },
  UpdateBranchRequest: {
    type: 'object',
    properties: { name: { type: 'string' }, address: { type: 'string' }, phone: { type: 'string' }, is_active: { type: 'boolean' } },
  },
  CreateCustomerRequest: {
    type: 'object',
    required: ['name'],
    properties: {
      name: { type: 'string', minLength: 2 },
      phone: { type: 'string', pattern: '^\\d{10}$', nullable: true },
      address: { type: 'string', nullable: true },
      credit_limit: { ...money('Credit limit in integer paise'), default: 0 },
    },
  },
  UpdateCustomerRequest: {
    type: 'object',
    properties: {
      name: { type: 'string' },
      phone: { type: 'string', nullable: true },
      address: { type: 'string', nullable: true },
      credit_limit: money(),
    },
  },
  CreateSupplierRequest: {
    type: 'object',
    required: ['name'],
    properties: {
      name: { type: 'string', minLength: 2 },
      phone: { type: 'string', nullable: true },
      address: { type: 'string', nullable: true },
      gst_number: { type: 'string', maxLength: 15, nullable: true },
    },
  },
  UpdateSupplierRequest: {
    type: 'object',
    properties: {
      name: { type: 'string' },
      phone: { type: 'string', nullable: true },
      address: { type: 'string', nullable: true },
      gst_number: { type: 'string', nullable: true },
    },
  },
  CreateProductRequest: {
    type: 'object',
    required: ['name', 'selling_price'],
    properties: {
      name: { type: 'string', minLength: 2 },
      barcode: { type: 'string', nullable: true },
      gst_rate: { type: 'number', default: 0 },
      hsn_code: { type: 'string', nullable: true },
      base_unit: { type: 'string', default: 'pcs' },
      category: { type: 'string', nullable: true },
      initial_quantity: { type: 'number', default: 0 },
      selling_price: money('Selling price in integer paise'),
      purchase_price: { ...money('Purchase price in integer paise'), default: 0 },
      min_stock_alert: { type: 'number', default: 0 },
    },
  },
  UpdateProductRequest: {
    type: 'object',
    properties: {
      name: { type: 'string' },
      barcode: { type: 'string', nullable: true },
      gst_rate: { type: 'number' },
      hsn_code: { type: 'string', nullable: true },
      base_unit: { type: 'string' },
      category: { type: 'string', nullable: true },
    },
  },
  AdjustInventoryRequest: {
    type: 'object',
    required: ['quantity_change', 'notes'],
    properties: {
      quantity_change: { type: 'number', description: 'Positive (inbound) or negative (outbound)' },
      notes: { type: 'string', minLength: 3, maxLength: 500 },
    },
  },
  CreateInvoiceRequest: {
    type: 'object',
    required: ['items'],
    properties: {
      customer_id: { ...uuid(), nullable: true },
      amount_paid: { ...money('Amount paid at billing time, in paise'), default: 0 },
      note: { type: 'string', nullable: true },
      items: {
        type: 'array',
        minItems: 1,
        items: {
          type: 'object',
          required: ['product_id', 'quantity'],
          properties: {
            product_id: uuid(),
            quantity: { type: 'number', minimum: 0 },
            unit_price: money('Optional; auto-fetched from inventory if omitted'),
            gst_rate: { type: 'number', description: 'Optional; auto-fetched from product if omitted' },
            discount_amount: { ...money(), default: 0 },
          },
        },
      },
    },
  },
  CreatePaymentRequest: {
    type: 'object',
    required: ['amount', 'payment_mode'],
    properties: {
      customer_id: { ...uuid(), nullable: true },
      amount: money('Amount received, in paise'),
      payment_mode: { type: 'string', enum: ['cash', 'upi', 'card', 'bank_transfer', 'cheque'] },
      allocations: { type: 'array', items: ref('AllocationItem') },
      reference_number: { type: 'string', nullable: true },
      note: { type: 'string', nullable: true },
      payment_date: dateStr(),
    },
  },
  AllocatePaymentRequest: {
    type: 'object',
    required: ['allocations'],
    properties: { allocations: { type: 'array', minItems: 1, items: ref('AllocationItem') } },
  },
  AllocationItem: {
    type: 'object',
    required: ['invoice_id', 'allocated_amount'],
    properties: { invoice_id: uuid(), allocated_amount: money('Amount applied to the invoice, in paise') },
  },
  CreateAdjustmentRequest: {
    type: 'object',
    required: ['customer_id', 'notes'],
    properties: {
      customer_id: uuid(),
      debit: { ...money(), default: 0 },
      credit: { ...money(), default: 0 },
      notes: { type: 'string', minLength: 3, maxLength: 500 },
    },
  },
  CreatePurchaseRequest: {
    type: 'object',
    required: ['branch_id', 'supplier_id', 'subtotal', 'total_amount', 'items'],
    properties: {
      branch_id: uuid(),
      supplier_id: uuid(),
      supplier_invoice_number: { type: 'string', nullable: true },
      purchase_date: dateStr(),
      subtotal: money(),
      tax_amount: { ...money(), default: 0 },
      discount_amount: { ...money(), default: 0 },
      total_amount: money(),
      paid_amount: { ...money(), default: 0 },
      notes: { type: 'string', nullable: true },
      items: {
        type: 'array',
        minItems: 1,
        items: {
          type: 'object',
          required: ['product_id', 'quantity', 'purchase_price', 'total'],
          properties: {
            product_id: uuid(),
            quantity: { type: 'number' },
            purchase_price: money(),
            tax_rate: { type: 'number', default: 0 },
            tax_amount: { ...money(), default: 0 },
            total: money(),
            batch_number: { type: 'string', nullable: true },
            expiry_date: { ...dateStr(), nullable: true },
          },
        },
      },
    },
  },
  CreateExpenseRequest: {
    type: 'object',
    required: ['branch_id', 'category', 'amount'],
    properties: {
      branch_id: uuid(),
      category: { type: 'string', enum: ['rent', 'electricity', 'wages', 'packaging', 'transport', 'maintenance', 'marketing', 'other'] },
      amount: money(),
      note: { type: 'string', nullable: true },
      payment_mode: { type: 'string', enum: ['cash', 'upi', 'bank_transfer'], default: 'cash' },
      expense_date: dateStr(),
    },
  },
  CreateOfferRequest: {
    type: 'object',
    required: ['name', 'offer_type', 'discount_value', 'applies_to', 'valid_from', 'valid_until'],
    properties: {
      branch_id: { ...uuid(), nullable: true },
      name: { type: 'string' },
      offer_type: { type: 'string', enum: ['flat', 'percentage', 'bogo', 'bundle'] },
      discount_value: { type: 'number', description: 'Paise (flat/bundle) or percent (percentage)' },
      applies_to: { type: 'string', enum: ['product', 'category', 'invoice', 'customer'] },
      applies_to_id: { ...uuid(), nullable: true },
      applies_to_category: { type: 'string', nullable: true },
      min_purchase_amount: { ...money(), default: 0 },
      max_uses: { type: 'integer', nullable: true },
      buy_quantity: { type: 'integer', nullable: true },
      get_quantity: { type: 'integer', nullable: true },
      valid_from: dateStr(),
      valid_until: dateStr(),
    },
  },
  UpdateOfferRequest: {
    type: 'object',
    properties: {
      name: { type: 'string' },
      discount_value: { type: 'number' },
      min_purchase_amount: money(),
      max_uses: { type: 'integer', nullable: true },
      buy_quantity: { type: 'integer', nullable: true },
      get_quantity: { type: 'integer', nullable: true },
      valid_from: dateStr(),
      valid_until: dateStr(),
      is_active: { type: 'boolean' },
    },
  },
  UpdateSettingsRequest: {
    type: 'object',
    additionalProperties: { type: 'string' },
    example: { invoice_prefix: 'INV', gst_number: '29ABCDE1234F1Z5' },
  },
  ChangePlanRequest: {
    type: 'object',
    required: ['plan_id'],
    properties: { plan_id: { type: 'string', example: 'growth' } },
  },

  // ─── General Ledger (Sprint 18) ───
  Account: {
    type: 'object',
    properties: {
      id: uuid(),
      tenant_id: uuid(),
      account_code: { type: 'string', example: '4000' },
      name: { type: 'string', example: 'Sales' },
      account_type: { type: 'string', enum: ['asset', 'liability', 'income', 'expense', 'equity'] },
      parent_id: { ...uuid(), nullable: true },
      is_system: { type: 'boolean' },
      is_active: { type: 'boolean' },
      children: { type: 'array', items: ref('Account'), description: 'Nested child accounts (tree response)' },
      created_at: ts(),
      updated_at: ts(),
    },
  },
  CreateAccountRequest: {
    type: 'object',
    required: ['account_code', 'name', 'account_type'],
    properties: {
      account_code: { type: 'string', example: '6100' },
      name: { type: 'string', example: 'Rent' },
      account_type: { type: 'string', enum: ['asset', 'liability', 'income', 'expense', 'equity'] },
      parent_id: { ...uuid(), nullable: true },
    },
  },
  JournalLine: {
    type: 'object',
    properties: {
      id: uuid(),
      journal_entry_id: uuid(),
      account_id: uuid(),
      debit: money('Debit amount in paise'),
      credit: money('Credit amount in paise'),
    },
  },
  JournalEntry: {
    type: 'object',
    properties: {
      id: uuid(),
      tenant_id: uuid(),
      branch_id: { ...uuid(), nullable: true },
      entry_date: dateStr(),
      narration: nullableStr(),
      reference_type: { type: 'string', example: 'invoice' },
      reference_id: { ...uuid(), nullable: true },
      status: { type: 'string', enum: ['posted', 'void'] },
      lines: { type: 'array', items: ref('JournalLine') },
      created_at: ts(),
    },
  },
  CreateJournalRequest: {
    type: 'object',
    required: ['lines'],
    description: 'Manual journal. SUM(debit) must equal SUM(credit) and be non-zero; each line has exactly one of debit/credit.',
    properties: {
      entry_date: dateStr(),
      narration: { type: 'string' },
      reference_type: { type: 'string', default: 'manual' },
      reference_id: { ...uuid(), nullable: true },
      lines: {
        type: 'array',
        minItems: 2,
        items: {
          type: 'object',
          required: ['account_id'],
          properties: { account_id: uuid(), debit: money(), credit: money() },
        },
      },
    },
  },
  AccountLedger: {
    type: 'object',
    properties: {
      account: ref('Account'),
      total_debit: money(),
      total_credit: money(),
      closing_balance: money('Running balance in paise (signed per account normal balance)'),
      entries: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            journal_entry_id: uuid(),
            entry_date: dateStr(),
            narration: nullableStr(),
            reference_type: { type: 'string' },
            reference_id: { ...uuid(), nullable: true },
            debit: money(),
            credit: money(),
            running_balance: money(),
          },
        },
      },
    },
  },
  PushSyncRequest: {
    type: 'object',
    required: ['device_id', 'entries'],
    properties: {
      device_id: { type: 'string' },
      device_name: { type: 'string' },
      entries: {
        type: 'array',
        minItems: 1,
        maxItems: 500,
        items: {
          type: 'object',
          required: ['id', 'table_name', 'record_id', 'action', 'version'],
          properties: {
            id: uuid(),
            table_name: { type: 'string' },
            record_id: uuid(),
            action: { type: 'string', enum: ['insert', 'update', 'delete'] },
            version: { type: 'integer' },
            conflict_strategy: { type: 'string', enum: ['server_wins', 'client_wins', 'manual'], default: 'server_wins' },
            payload: { type: 'object', nullable: true, additionalProperties: true },
            created_at: { type: 'string' },
          },
        },
      },
    },
  },
  RetrySyncRequest: {
    type: 'object',
    required: ['entry_ids'],
    properties: { entry_ids: { type: 'array', items: uuid(), minItems: 1, maxItems: 100 } },
  },
  ParseProductRequest: { type: 'object', required: ['text'], properties: { text: { type: 'string', maxLength: 500 } } },
  ParseVoiceRequest: { type: 'object', required: ['transcript'], properties: { transcript: { type: 'string', maxLength: 2000 } } },
  SuggestProductsRequest: { type: 'object', required: ['query'], properties: { query: { type: 'string', maxLength: 200 } } },
  EnrichProductRequest: { type: 'object', required: ['product_id'], properties: { product_id: uuid() } },
};

const paths: any = {
  // ─── Health ───
  '/health': {
    get: {
      tags: ['Health'], summary: 'Liveness + dependency status', security: [],
      responses: { '200': dataResp('Service & dependency status', { type: 'object' }) },
    },
  },
  '/health/ready': {
    get: {
      tags: ['Health'], summary: 'Readiness probe', security: [],
      responses: {
        '200': dataResp('Ready to serve traffic', { type: 'object' }),
        '503': { description: 'Not ready', content: content(ref('Error')) },
      },
    },
  },

  // ─── Auth ───
  '/auth/register': {
    post: {
      tags: ['Auth'], summary: 'Register a new tenant and its first admin user', security: [],
      requestBody: reqBody('RegisterRequest'),
      responses: {
        '201': dataResp('Tenant + admin created, JWT issued', ref('AuthToken')),
        '400': errorResponses['400'],
        '409': { description: 'Tenant email already registered', content: content(ref('Error')) },
      },
    },
  },
  '/auth/login': {
    post: {
      tags: ['Auth'], summary: 'Authenticate and receive a JWT', security: [],
      requestBody: reqBody('LoginRequest'),
      responses: { '200': dataResp('Authenticated', ref('AuthToken')), '400': errorResponses['400'], '401': errorResponses['401'] },
    },
  },

  // ─── Tenants ───
  '/tenants/me': {
    get: { tags: ['Tenants'], summary: 'Get the current tenant profile', responses: { '200': dataResp('Tenant', ref('Tenant')), '401': errorResponses['401'] } },
    patch: { tags: ['Tenants'], summary: 'Update the current tenant profile', requestBody: reqBody('UpdateTenantRequest'), responses: { '200': dataResp('Updated tenant', ref('Tenant')), ...errorResponses } },
  },

  // ─── Users (admin) ───
  '/users': {
    get: { tags: ['Users'], summary: 'List staff users (admin)', responses: { '200': dataResp('Users', { type: 'array', items: ref('UserPublic') }), ...errorResponses } },
    post: { tags: ['Users'], summary: 'Create a staff user (admin)', requestBody: reqBody('CreateUserRequest'), responses: { '201': dataResp('Created user', ref('UserPublic')), ...errorResponses } },
  },
  '/users/{id}': {
    patch: { tags: ['Users'], summary: 'Update a user (admin)', parameters: [pathId('id', 'User UUID')], requestBody: reqBody('UpdateUserRequest'), responses: { '200': dataResp('Updated user', ref('UserPublic')), ...errorResponses } },
    delete: { tags: ['Users'], summary: 'Soft-delete a user (admin)', parameters: [pathId('id', 'User UUID')], responses: { '200': dataResp('Deleted', { type: 'object' }), ...errorResponses } },
  },

  // ─── Branches ───
  '/branches': {
    get: { tags: ['Branches'], summary: 'List branches', responses: { '200': dataResp('Branches', { type: 'array', items: ref('Branch') }), ...errorResponses } },
    post: { tags: ['Branches'], summary: 'Create a branch (admin)', requestBody: reqBody('CreateBranchRequest'), responses: { '201': dataResp('Created branch', ref('Branch')), ...errorResponses } },
  },
  '/branches/{id}': {
    patch: { tags: ['Branches'], summary: 'Update a branch (admin)', parameters: [pathId('id', 'Branch UUID')], requestBody: reqBody('UpdateBranchRequest'), responses: { '200': dataResp('Updated branch', ref('Branch')), ...errorResponses } },
    delete: { tags: ['Branches'], summary: 'Soft-delete a branch (admin)', parameters: [pathId('id', 'Branch UUID')], responses: { '200': dataResp('Deleted', { type: 'object' }), ...errorResponses } },
  },

  // ─── Products ───
  '/products': {
    get: { tags: ['Products'], summary: 'List products with inventory', responses: { '200': dataResp('Products', { type: 'array', items: ref('Product') }), ...errorResponses } },
    post: { tags: ['Products'], summary: 'Create a product + initial inventory (admin)', requestBody: reqBody('CreateProductRequest'), responses: { '201': dataResp('Created product', ref('Product')), ...errorResponses } },
  },
  '/products/barcode/{code}': {
    get: { tags: ['Products'], summary: 'Look up a product by barcode', parameters: [{ name: 'code', in: 'path', required: true, schema: { type: 'string' }, description: 'Barcode value' }], responses: { '200': dataResp('Product', ref('Product')), ...errorResponses } },
  },
  '/products/low-stock': {
    get: { tags: ['Products'], summary: 'List products below their min-stock alert', responses: { '200': dataResp('Low-stock products', { type: 'array', items: ref('Product') }), ...errorResponses } },
  },
  '/products/{id}': {
    patch: { tags: ['Products'], summary: 'Update product catalogue info (admin)', parameters: [pathId('id', 'Product UUID')], requestBody: reqBody('UpdateProductRequest'), responses: { '200': dataResp('Updated product', ref('Product')), ...errorResponses } },
    delete: { tags: ['Products'], summary: 'Soft-delete a product (admin)', parameters: [pathId('id', 'Product UUID')], responses: { '200': dataResp('Deleted', { type: 'object' }), ...errorResponses } },
  },
  '/products/{id}/adjust': {
    post: { tags: ['Products'], summary: 'Manually adjust inventory stock (admin)', parameters: [pathId('id', 'Product UUID')], requestBody: reqBody('AdjustInventoryRequest'), responses: { '200': dataResp('Adjusted inventory', ref('Inventory')), ...errorResponses } },
  },

  // ─── Customers ───
  '/customers': {
    get: { tags: ['Customers'], summary: 'List/search customers', parameters: [query('q', { type: 'string' }, 'Optional name/phone search')], responses: { '200': dataResp('Customers', { type: 'array', items: ref('Customer') }), ...errorResponses } },
    post: { tags: ['Customers'], summary: 'Create a customer', requestBody: reqBody('CreateCustomerRequest'), responses: { '201': dataResp('Created customer', ref('Customer')), ...errorResponses } },
  },
  '/customers/{id}': {
    get: { tags: ['Customers'], summary: 'Get a customer', parameters: [pathId('id', 'Customer UUID')], responses: { '200': dataResp('Customer', ref('Customer')), ...errorResponses } },
    patch: { tags: ['Customers'], summary: 'Update a customer', parameters: [pathId('id', 'Customer UUID')], requestBody: reqBody('UpdateCustomerRequest'), responses: { '200': dataResp('Updated customer', ref('Customer')), ...errorResponses } },
    delete: { tags: ['Customers'], summary: 'Soft-delete a customer', parameters: [pathId('id', 'Customer UUID')], responses: { '200': dataResp('Deleted', { type: 'object' }), ...errorResponses } },
  },

  // ─── Suppliers ───
  '/suppliers': {
    get: { tags: ['Suppliers'], summary: 'List/search suppliers', parameters: [query('q', { type: 'string' }, 'Optional search')], responses: { '200': dataResp('Suppliers', { type: 'array', items: ref('Supplier') }), ...errorResponses } },
    post: { tags: ['Suppliers'], summary: 'Create a supplier', requestBody: reqBody('CreateSupplierRequest'), responses: { '201': dataResp('Created supplier', ref('Supplier')), ...errorResponses } },
  },
  '/suppliers/{id}': {
    get: { tags: ['Suppliers'], summary: 'Get a supplier', parameters: [pathId('id', 'Supplier UUID')], responses: { '200': dataResp('Supplier', ref('Supplier')), ...errorResponses } },
    patch: { tags: ['Suppliers'], summary: 'Update a supplier', parameters: [pathId('id', 'Supplier UUID')], requestBody: reqBody('UpdateSupplierRequest'), responses: { '200': dataResp('Updated supplier', ref('Supplier')), ...errorResponses } },
    delete: { tags: ['Suppliers'], summary: 'Soft-delete a supplier', parameters: [pathId('id', 'Supplier UUID')], responses: { '200': dataResp('Deleted', { type: 'object' }), ...errorResponses } },
  },

  // ─── Invoices ───
  '/invoices': {
    get: {
      tags: ['Invoices'], summary: 'List invoices (paginated)',
      parameters: [...paginationQuery, query('status', { type: 'string', enum: ['paid', 'partial', 'unpaid', 'cancelled'] }), query('customer_id', uuid())],
      responses: { '200': listResp('Invoices', ref('Invoice')), ...errorResponses },
    },
    post: {
      tags: ['Invoices'],
      summary: 'Create an invoice (atomic billing). Gated by the max_invoices_per_month plan quota; auto-applies the best active offer per line.',
      requestBody: reqBody('CreateInvoiceRequest'),
      responses: { '201': dataResp('Created invoice', ref('Invoice')), ...errorResponses },
    },
  },
  '/invoices/{id}': {
    get: { tags: ['Invoices'], summary: 'Get an invoice with line items', parameters: [pathId('id', 'Invoice UUID')], responses: { '200': dataResp('Invoice with items', { allOf: [ref('Invoice'), { type: 'object', properties: { items: { type: 'array', items: ref('InvoiceItem') } } }] }), ...errorResponses } },
    delete: { tags: ['Invoices'], summary: 'Cancel an invoice (reverses stock & ledger)', parameters: [pathId('id', 'Invoice UUID')], responses: { '200': dataResp('Cancelled', { type: 'object' }), ...errorResponses } },
  },

  // ─── Payments ───
  '/payments': {
    post: { tags: ['Payments'], summary: 'Record a payment (optionally allocate to invoices)', requestBody: reqBody('CreatePaymentRequest'), responses: { '201': dataResp('Created payment', ref('Payment')), ...errorResponses } },
    get: {
      tags: ['Payments'], summary: 'List payments (paginated)',
      parameters: [...paginationQuery, query('customer_id', uuid()), query('status', { type: 'string', enum: ['received', 'fully_allocated', 'partially_allocated'] }), query('payment_mode', { type: 'string', enum: ['cash', 'upi', 'card', 'bank_transfer', 'cheque'] })],
      responses: { '200': listResp('Payments', ref('Payment')), ...errorResponses },
    },
  },
  '/payments/{id}': {
    get: { tags: ['Payments'], summary: 'Get a payment with its allocations', parameters: [pathId('id', 'Payment UUID')], responses: { '200': dataResp('Payment', ref('Payment')), ...errorResponses } },
  },
  '/payments/{id}/allocate': {
    post: { tags: ['Payments'], summary: 'Allocate an advance payment to invoices', parameters: [pathId('id', 'Payment UUID')], requestBody: reqBody('AllocatePaymentRequest'), responses: { '200': dataResp('Updated payment', ref('Payment')), ...errorResponses } },
  },

  // ─── Ledger ───
  '/customers/{id}/ledger': {
    get: {
      tags: ['Ledger'], summary: 'Customer ledger entries (paginated)',
      parameters: [pathId('id', 'Customer UUID'), ...paginationQuery, query('from', dateStr()), query('to', dateStr()), query('entry_type', { type: 'string', enum: ['invoice', 'payment', 'adjustment'] })],
      responses: { '200': listResp('Ledger entries', ref('CustomerLedger')), ...errorResponses },
    },
  },
  '/customers/{id}/balance': {
    get: { tags: ['Ledger'], summary: 'Customer balance summary', parameters: [pathId('id', 'Customer UUID')], responses: { '200': dataResp('Balance summary', { type: 'object' }), ...errorResponses } },
  },
  '/ledger/adjust': {
    post: { tags: ['Ledger'], summary: 'Manual ledger adjustment (admin)', requestBody: reqBody('CreateAdjustmentRequest'), responses: { '201': dataResp('Adjustment entry', ref('CustomerLedger')), ...errorResponses } },
  },

  // ─── Purchases ───
  '/purchases': {
    get: {
      tags: ['Purchases'], summary: 'List purchases (paginated)',
      parameters: [...paginationQuery, query('branch_id', uuid()), query('supplier_id', uuid()), query('from', dateStr()), query('to', dateStr())],
      responses: { '200': listResp('Purchases', ref('Purchase')), ...errorResponses },
    },
    post: { tags: ['Purchases'], summary: 'Create a purchase + stock-in (admin)', requestBody: reqBody('CreatePurchaseRequest'), responses: { '201': dataResp('Created purchase', ref('Purchase')), ...errorResponses } },
  },
  '/purchases/{id}': {
    get: { tags: ['Purchases'], summary: 'Get a purchase with items', parameters: [pathId('id', 'Purchase UUID')], responses: { '200': dataResp('Purchase', ref('Purchase')), ...errorResponses } },
  },

  // ─── Expenses ───
  '/expenses': {
    get: {
      tags: ['Expenses'], summary: 'List expenses (paginated)',
      parameters: [...paginationQuery, query('branch_id', uuid()), query('category', { type: 'string' }), query('from', dateStr()), query('to', dateStr())],
      responses: { '200': listResp('Expenses', ref('Expense')), ...errorResponses },
    },
    post: { tags: ['Expenses'], summary: 'Record an expense (admin)', requestBody: reqBody('CreateExpenseRequest'), responses: { '201': dataResp('Created expense', ref('Expense')), ...errorResponses } },
  },
  '/expenses/{id}': {
    delete: { tags: ['Expenses'], summary: 'Soft-delete an expense (admin)', parameters: [pathId('id', 'Expense UUID')], responses: { '200': dataResp('Deleted', { type: 'object' }), ...errorResponses } },
  },

  // ─── Offers ───
  '/offers': {
    get: {
      tags: ['Offers'], summary: 'List offers (paginated)',
      parameters: [...paginationQuery, query('branch_id', uuid()), query('offer_type', { type: 'string', enum: ['flat', 'percentage', 'bogo', 'bundle'] }), query('applies_to', { type: 'string', enum: ['product', 'category', 'invoice', 'customer'] }), query('is_active', { type: 'string', enum: ['true', 'false'] }), query('from', dateStr()), query('to', dateStr())],
      responses: { '200': listResp('Offers', ref('Offer')), ...errorResponses },
    },
    post: { tags: ['Offers'], summary: 'Create an offer (admin)', requestBody: reqBody('CreateOfferRequest'), responses: { '201': dataResp('Created offer', ref('Offer')), ...errorResponses } },
  },
  '/offers/{id}': {
    get: { tags: ['Offers'], summary: 'Get an offer', parameters: [pathId('id', 'Offer UUID')], responses: { '200': dataResp('Offer', ref('Offer')), ...errorResponses } },
    patch: { tags: ['Offers'], summary: 'Update an offer (admin)', parameters: [pathId('id', 'Offer UUID')], requestBody: reqBody('UpdateOfferRequest'), responses: { '200': dataResp('Updated offer', ref('Offer')), ...errorResponses } },
    delete: { tags: ['Offers'], summary: 'Soft-delete an offer (admin)', parameters: [pathId('id', 'Offer UUID')], responses: { '200': dataResp('Deleted', { type: 'object' }), ...errorResponses } },
  },

  // ─── Sync ───
  '/sync/push': {
    post: { tags: ['Sync'], summary: 'Push local changes to the server', requestBody: reqBody('PushSyncRequest'), responses: { '200': dataResp('Push result', { type: 'object' }), ...errorResponses } },
  },
  '/sync/pull': {
    get: { tags: ['Sync'], summary: 'Pull server changes since a version', parameters: [query('device_id', { type: 'string' }), query('since_version', { type: 'string', default: '0' }), query('limit', { type: 'string', default: '200' })], responses: { '200': dataResp('Changes', { type: 'object' }), ...errorResponses } },
  },
  '/sync/status': {
    get: { tags: ['Sync'], summary: 'Sync health for a device', parameters: [query('device_id', { type: 'string' })], responses: { '200': dataResp('Status', { type: 'object' }), ...errorResponses } },
  },
  '/sync/devices': {
    get: { tags: ['Sync'], summary: 'List registered devices', responses: { '200': dataResp('Devices', { type: 'array', items: ref('SyncDevice') }), ...errorResponses } },
  },
  '/sync/queue': {
    get: {
      tags: ['Sync'], summary: 'List sync-queue entries (admin)',
      parameters: [...paginationQuery, query('is_synced', { type: 'string', enum: ['true', 'false'] }), query('device_id', { type: 'string' }), query('table_name', { type: 'string' }), query('action', { type: 'string', enum: ['insert', 'update', 'delete'] })],
      responses: { '200': listResp('Queue entries', { type: 'object' }), ...errorResponses },
    },
  },
  '/sync/failed': {
    get: { tags: ['Sync'], summary: 'List failed sync entries (admin)', responses: { '200': dataResp('Failed entries', { type: 'array', items: { type: 'object' } }), ...errorResponses } },
  },
  '/sync/retry': {
    post: { tags: ['Sync'], summary: 'Retry failed sync entries (admin)', requestBody: reqBody('RetrySyncRequest'), responses: { '200': dataResp('Retry result', { type: 'object' }), ...errorResponses } },
  },
  '/sync/acknowledge': {
    post: { tags: ['Sync'], summary: 'Acknowledge applied changes (admin)', requestBody: reqBody('RetrySyncRequest', false), responses: { '200': dataResp('Acknowledged', { type: 'object' }), ...errorResponses } },
  },

  // ─── Alerts ───
  '/alerts': {
    get: {
      tags: ['Alerts'], summary: 'List alerts (paginated)',
      parameters: [...paginationQuery, query('branch_id', uuid()), query('is_read', { type: 'string', enum: ['true', 'false'] }), query('alert_type', { type: 'string', enum: ['low_stock', 'payment_due', 'high_demand', 'expiry_soon', 'sync_failed'] })],
      responses: { '200': listResp('Alerts', ref('Alert')), ...errorResponses },
    },
  },
  '/alerts/{id}/read': {
    patch: { tags: ['Alerts'], summary: 'Mark an alert as read', parameters: [pathId('id', 'Alert UUID')], responses: { '200': dataResp('Updated alert', ref('Alert')), ...errorResponses } },
  },

  // ─── Analytics (admin) ───
  '/analytics/daily': {
    get: { tags: ['Analytics'], summary: 'Daily metrics for a date range (admin)', parameters: [query('start_date', dateStr()), query('end_date', dateStr()), query('branch_id', uuid())], responses: { '200': dataResp('Daily metrics', { type: 'array', items: { type: 'object' } }), ...errorResponses } },
  },
  '/analytics/dashboard': {
    get: { tags: ['Analytics'], summary: 'Dashboard summary (admin)', parameters: [query('branch_id', uuid())], responses: { '200': dataResp('Dashboard data', { type: 'object' }), ...errorResponses } },
  },
  '/analytics/profit': {
    get: { tags: ['Analytics'], summary: 'Profit report for a date range (admin)', parameters: [query('start_date', dateStr()), query('end_date', dateStr()), query('branch_id', uuid())], responses: { '200': dataResp('Profit data', { type: 'object' }), ...errorResponses } },
  },

  // ─── AI ───
  '/ai/parse-product': {
    post: { tags: ['AI'], summary: 'Parse free-text into structured product data', requestBody: reqBody('ParseProductRequest'), responses: { '200': dataResp('Parsed product (AI or fallback)', { type: 'object' }), ...errorResponses } },
  },
  '/ai/parse-voice': {
    post: { tags: ['AI'], summary: 'Parse a voice transcript into invoice items', requestBody: reqBody('ParseVoiceRequest'), responses: { '200': dataResp('Parsed items', { type: 'object' }), ...errorResponses } },
  },
  '/ai/suggest-products': {
    post: { tags: ['AI'], summary: 'Smart product suggestions for a query', requestBody: reqBody('SuggestProductsRequest'), responses: { '200': dataResp('Suggestions', { type: 'object' }), ...errorResponses } },
  },
  '/ai/demand/{productId}': {
    get: { tags: ['AI'], summary: 'Demand prediction for a product', parameters: [pathId('productId', 'Product UUID')], responses: { '200': dataResp('Demand forecast', { type: 'object' }), ...errorResponses } },
  },
  '/ai/enrich-product': {
    post: { tags: ['AI'], summary: 'Enrich a product with AI metadata (cached)', requestBody: reqBody('EnrichProductRequest'), responses: { '200': dataResp('Enriched data', { type: 'object' }), ...errorResponses } },
  },
  '/ai/suggestions/{productId}': {
    get: { tags: ['AI'], summary: 'Get cached AI data for a product', parameters: [pathId('productId', 'Product UUID')], responses: { '200': dataResp('AI data', { type: 'object' }), ...errorResponses } },
  },

  // ─── Settings ───
  '/settings': {
    get: { tags: ['Settings'], summary: 'Get tenant settings (key/value map)', responses: { '200': dataResp('Settings map', ref('Setting')), ...errorResponses } },
    patch: { tags: ['Settings'], summary: 'Upsert tenant settings (admin)', requestBody: reqBody('UpdateSettingsRequest'), responses: { '200': dataResp('Updated settings map', ref('Setting')), ...errorResponses } },
  },

  // ─── Subscriptions ───
  '/subscriptions': {
    get: { tags: ['Subscriptions'], summary: 'Current plan, status, usage vs limits, and plan catalogue', responses: { '200': dataResp('Subscription overview', ref('SubscriptionOverview')), ...errorResponses } },
  },
  '/subscriptions/change-plan': {
    post: { tags: ['Subscriptions'], summary: 'Upgrade/downgrade the tenant plan (admin)', requestBody: reqBody('ChangePlanRequest'), responses: { '200': dataResp('Updated subscription overview', ref('SubscriptionOverview')), ...errorResponses } },
  },

  // ─── General Ledger (Sprint 18) ───
  '/accounts': {
    get: { tags: ['Accounts'], summary: 'Chart of accounts as a tree', responses: { '200': dataResp('Account tree', { type: 'array', items: ref('Account') }), ...errorResponses } },
    post: { tags: ['Accounts'], summary: 'Create a ledger account (admin)', requestBody: reqBody('CreateAccountRequest'), responses: { '201': dataResp('Created account', ref('Account')), ...errorResponses } },
  },
  '/accounts/{id}/ledger': {
    get: {
      tags: ['Accounts'], summary: 'Account ledger with running balance',
      parameters: [pathId('id', 'Account UUID'), query('from', dateStr()), query('to', dateStr())],
      responses: { '200': dataResp('Account ledger', ref('AccountLedger')), ...errorResponses },
    },
  },
  '/journals': {
    get: {
      tags: ['Journals'], summary: 'List journal entries with their lines (paginated)',
      parameters: [...paginationQuery, query('from', dateStr()), query('to', dateStr()), query('reference_type', { type: 'string' }), query('reference_id', uuid())],
      responses: { '200': listResp('Journal entries', ref('JournalEntry')), ...errorResponses },
    },
    post: { tags: ['Journals'], summary: 'Post a balanced manual journal (admin)', requestBody: reqBody('CreateJournalRequest'), responses: { '201': dataResp('Posted journal entry', ref('JournalEntry')), ...errorResponses } },
  },
};

export const openapiDocument: any = {
  openapi: '3.0.3',
  info: {
    title: 'DhanLekha ERP API',
    version: '1.0.0',
    description:
      'REST API for the DhanLekha AI-powered offline ERP & billing system. ' +
      'All money values are integer paise (₹1 = 100 paise). Authenticate via ' +
      '`POST /api/v1/auth/login` and send the returned JWT as `Authorization: Bearer <token>`.',
  },
  servers: [{ url: '/api/v1', description: 'API v1' }],
  tags: [
    { name: 'Health', description: 'Liveness & readiness probes' },
    { name: 'Auth', description: 'Registration & login' },
    { name: 'Tenants', description: 'Tenant profile (self)' },
    { name: 'Users', description: 'Staff user management (admin)' },
    { name: 'Branches', description: 'Store/branch management' },
    { name: 'Products', description: 'Catalogue & inventory' },
    { name: 'Customers', description: 'Customer master' },
    { name: 'Suppliers', description: 'Supplier master' },
    { name: 'Invoices', description: 'Billing engine' },
    { name: 'Payments', description: 'Payments & allocations' },
    { name: 'Ledger', description: 'Customer ledger & adjustments' },
    { name: 'Purchases', description: 'Purchase entries' },
    { name: 'Expenses', description: 'Expense tracking' },
    { name: 'Offers', description: 'Promotions & discounts' },
    { name: 'Sync', description: 'Offline sync engine' },
    { name: 'Alerts', description: 'System alerts' },
    { name: 'Analytics', description: 'Dashboards & reports (admin)' },
    { name: 'AI', description: 'AI-assisted features' },
    { name: 'Settings', description: 'Tenant configuration' },
    { name: 'Subscriptions', description: 'Plan & usage' },
    { name: 'Accounts', description: 'Chart of accounts & account ledgers (GL)' },
    { name: 'Journals', description: 'Double-entry journal entries (GL)' },
  ],
  components: {
    securitySchemes: {
      bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
    },
    schemas,
  },
  security: bearer,
  paths,
};
