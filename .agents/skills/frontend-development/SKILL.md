---
name: dhanlekha-frontend
description: >
  Frontend development skill for DhanLekha ERP — Next.js + TypeScript + Electron
  desktop application. Use this skill for every frontend task: building pages,
  components, hooks, API integration, state management, offline behaviour,
  routing, forms, tables, modals, charts, or any UI work. Must be consulted
  before writing any React component, Next.js page, Axios call, Zustand store,
  or Electron IPC handler. Triggers on: "build a screen", "create a component",
  "connect to API", "add a form", "create a hook", "build the billing screen",
  "dashboard UI", "offline indicator", "sync status", or any mention of a
  DhanLekha frontend page or feature.
compatibility:
  runtime: Node.js 20+
  framework: Next.js 16 (App Router)
  language: TypeScript latest
  desktop: Electron latest
  state: Zustand latest
  http: Axios (shared instance from @dhanlekha/shared)
  ui: Tailwind CSS + shadcn/ui
  charts: Recharts
  forms: React Hook Form + Zod
  icons: Lucide React
  toast: sonner
---

# DhanLekha Frontend Skill

The authoritative guide for all DhanLekha frontend development.
Read the relevant section before writing any component, hook, or page.

---

## 0. App at a glance

| Item              | Value                                              |
|-------------------|----------------------------------------------------|
| Framework         | Next.js 14 App Router                             |
| Language          | TypeScript (strict mode, no `any`)                |
| Desktop shell     | Electron 30 (wraps Next.js for offline desktop)   |
| State             | Zustand (per-domain stores)                       |
| HTTP              | Axios — `@dhanlekha/shared` instance only         |
| Styling           | Tailwind CSS + shadcn/ui components               |
| Forms             | React Hook Form + Zod (shared schemas)            |
| Charts            | Recharts                                          |
| Icons             | Lucide React                                      |
| Types             | Always from `@dhanlekha/shared/types` — never re-declare|

---

## 1. Absolute rules — read before every task

1. **Types come from `@dhanlekha/shared/types` only.**
   Never declare a local interface that duplicates a shared type.
   Import: `import type { Invoice, Customer, Product } from '@dhanlekha/shared/types'`

2. **HTTP via `@dhanlekha/shared` api instance only.**
   Never create a new Axios instance. Never use `fetch`.
   Import: `import api from '@dhanlekha/shared/api'`

3. **No TypeScript `any`.** Use proper types or `unknown` with guards.

4. **All API calls go inside custom hooks.** Never call `api.get()` directly
   inside a component. Always use a `use[Domain]()` hook.

5. **Server-side calculations are authoritative.** Never calculate totals,
   balances, or GST amounts in the frontend — display what the API returns.

6. **Keyboard-first for desktop screens.** Every billing and inventory action
   must be reachable without a mouse. Tab order and Enter key must work.

7. **Soft-delete awareness.** Never show a "delete" button that hard-deletes.
   Always call the API DELETE endpoint (which soft-deletes server-side).

8. **Offline state must always be visible.** The sync status indicator is
   present on every authenticated screen — never hide it.

9. **tenant_id is never stored in frontend state.** It comes from JWT decoded
   server-side. Never read or write it in frontend code.

10. **Role-based UI.** Cashier users must not see admin-only screens or buttons.
    Use `useAuth().role` to conditionally render.

---

## 2. Folder structure

```
apps/frontend/
├── app/                          # Next.js App Router
│   ├── (auth)/                   # Auth group (login, register)
│   │   ├── login/page.tsx
│   │   └── register/page.tsx
│   ├── (app)/                    # Authenticated app group
│   │   ├── layout.tsx            # Shell layout (sidebar, header, sync indicator)
│   │   ├── dashboard/page.tsx
│   │   ├── billing/
│   │   │   ├── page.tsx          # New invoice screen
│   │   │   └── [id]/page.tsx     # Invoice detail
│   │   ├── invoices/page.tsx     # Invoice history list
│   │   ├── products/
│   │   │   ├── page.tsx          # Product list
│   │   │   └── [id]/page.tsx     # Product detail / edit
│   │   ├── inventory/page.tsx    # Stock levels + adjustments
│   │   ├── customers/
│   │   │   ├── page.tsx
│   │   │   └── [id]/
│   │   │       ├── page.tsx      # Customer detail + ledger
│   │   │       └── ledger/page.tsx
│   │   ├── suppliers/page.tsx
│   │   ├── purchases/page.tsx
│   │   ├── expenses/page.tsx
│   │   ├── offers/page.tsx
│   │   ├── payments/page.tsx
│   │   ├── analytics/page.tsx
│   │   ├── alerts/page.tsx
│   │   ├── sync/page.tsx
│   │   ├── settings/page.tsx
│   │   └── staff/page.tsx        # Admin only
│   └── layout.tsx                # Root layout (providers, fonts)
├── components/
│   ├── ui/                       # shadcn/ui base components (Button, Input, etc)
│   ├── layout/
│   │   ├── Sidebar.tsx
│   │   ├── Header.tsx
│   │   ├── SyncIndicator.tsx     # Always-visible offline/sync status
│   │   └── AppShell.tsx
│   ├── billing/
│   │   ├── BillingCart.tsx       # Line items table
│   │   ├── ProductSearch.tsx     # Barcode + name search input
│   │   ├── InvoiceSummary.tsx    # Total, tax, discount, final
│   │   ├── PaymentCapture.tsx    # Cash/UPI/Card amount input
│   │   └── OfferBadge.tsx        # Applied offer indicator
│   ├── products/
│   │   ├── ProductTable.tsx
│   │   ├── ProductForm.tsx
│   │   └── StockBadge.tsx        # Green/yellow/red stock level
│   ├── customers/
│   │   ├── CustomerCard.tsx
│   │   ├── LedgerTable.tsx
│   │   └── BalanceBadge.tsx
│   ├── analytics/
│   │   ├── MetricCard.tsx
│   │   ├── SalesChart.tsx        # Recharts line chart
│   │   ├── ProfitCard.tsx
│   │   └── TopProductsTable.tsx
│   └── shared/
│       ├── DataTable.tsx         # Reusable paginated table
│       ├── SearchInput.tsx
│       ├── StatusBadge.tsx       # paid/partial/unpaid/cancelled
│       ├── ConfirmDialog.tsx
│       ├── EmptyState.tsx
│       └── LoadingSpinner.tsx
├── hooks/
│   ├── useAuth.ts                # Auth state, login, logout, role check
│   ├── useProducts.ts            # Products CRUD + barcode lookup
│   ├── useInventory.ts           # Stock levels + adjustments
│   ├── useInvoices.ts            # Invoice list + create + cancel
│   ├── useBilling.ts             # Active billing session (cart state)
│   ├── useCustomers.ts           # Customer CRUD + balance
│   ├── useSuppliers.ts
│   ├── usePurchases.ts
│   ├── usePayments.ts
│   ├── useLedger.ts              # Customer ledger entries
│   ├── useExpenses.ts
│   ├── useOffers.ts
│   ├── useAlerts.ts
│   ├── useAnalytics.ts
│   ├── useSync.ts                # Sync status + trigger
│   └── useAI.ts                  # AI features (parse, suggest, voice)
├── stores/
│   ├── auth.store.ts             # JWT token, user, role
│   ├── billing.store.ts          # Active invoice cart
│   ├── sync.store.ts             # Offline queue + sync status
│   └── ui.store.ts               # Global UI state (sidebar open, etc)
├── lib/
│   ├── formatters.ts             # ₹ formatting, date formatting, GST display
│   ├── validators.ts             # Zod schemas for forms (import shared where possible)
│   ├── keyboard.ts               # Keyboard shortcut registry
│   └── offline.ts                # navigator.onLine helpers
├── electron/
│   ├── main.ts                   # Electron main process
│   ├── preload.ts                # Context bridge (IPC)
│   └── ipc/
│       ├── sync.ipc.ts           # Sync trigger IPC handler
│       └── print.ipc.ts          # Invoice print IPC handler
└── types/
    └── index.ts                  # Local-only types (UI state, form values)
    # NEVER re-declare API types here — use @dhanlekha/shared/types
```

---

## 3. Shared types — import pattern

```typescript
// ✅ Always — import from shared package
import type {
  Invoice,
  InvoiceItem,
  Customer,
  Product,
  Inventory,
  Payment,
  PaymentAllocation,
  CustomerLedgerEntry,
  Purchase,
  Expense,
  Offer,
  Alert,
  SyncQueueItem,
  DailyMetric,
  User,
  Tenant,
  Plan,
} from '@dhanlekha/shared/types';

// ✅ Local UI-only types go in /types/index.ts
interface BillingCartItem {
  product: Product;
  quantity: number;
  appliedOffer?: Offer;
  lineTotal: number;
}

// ❌ Never — re-declare a type that exists in shared
interface Invoice { ... } // WRONG
```

---

## 4. API integration pattern

All API calls follow this exact pattern. No exceptions.

```typescript
// hooks/useInvoices.ts
import { useState, useCallback } from 'react';
import api from '@dhanlekha/shared/api';
import type { Invoice } from '@dhanlekha/shared/types';

export function useInvoices() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchInvoices = useCallback(async (params?: {
    page?: number;
    limit?: number;
    status?: string;
  }) => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<{ data: Invoice[]; total: number }>('/invoices', { params });
      setInvoices(res.data.data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load invoices');
    } finally {
      setLoading(false);
    }
  }, []);

  const createInvoice = useCallback(async (payload: CreateInvoicePayload) => {
    const res = await api.post<{ data: Invoice }>('/invoices', payload);
    return res.data.data;
  }, []);

  return { invoices, loading, error, fetchInvoices, createInvoice };
}
```

---

## 5. State management — Zustand stores

```typescript
// stores/billing.store.ts
import { create } from 'zustand';
import type { Product, Offer } from '@dhanlekha/shared/types';
import type { BillingCartItem } from '@/types';

interface BillingStore {
  customerId: string | null;
  items: BillingCartItem[];
  amountPaid: number;
  paymentMode: 'cash' | 'upi' | 'card' | 'credit';
  setCustomer: (id: string) => void;
  addItem: (product: Product, quantity?: number) => void;
  removeItem: (productId: string) => void;
  updateQuantity: (productId: string, qty: number) => void;
  applyOffer: (productId: string, offer: Offer) => void;
  setAmountPaid: (amount: number) => void;
  setPaymentMode: (mode: BillingStore['paymentMode']) => void;
  clearCart: () => void;
}

export const useBillingStore = create<BillingStore>((set) => ({
  customerId: null,
  items: [],
  amountPaid: 0,
  paymentMode: 'cash',
  setCustomer: (id) => set({ customerId: id }),
  addItem: (product, quantity = 1) =>
    set((state) => {
      const existing = state.items.find((i) => i.product.id === product.id);
      if (existing) {
        return {
          items: state.items.map((i) =>
            i.product.id === product.id
              ? { ...i, quantity: i.quantity + quantity }
              : i
          ),
        };
      }
      return {
        items: [...state.items, { product, quantity, lineTotal: product.selling_price * quantity }],
      };
    }),
  removeItem: (productId) =>
    set((state) => ({ items: state.items.filter((i) => i.product.id !== productId) })),
  updateQuantity: (productId, qty) =>
    set((state) => ({
      items: state.items.map((i) =>
        i.product.id === productId ? { ...i, quantity: qty } : i
      ),
    })),
  applyOffer: (productId, offer) =>
    set((state) => ({
      items: state.items.map((i) =>
        i.product.id === productId ? { ...i, appliedOffer: offer } : i
      ),
    })),
  setAmountPaid: (amount) => set({ amountPaid: amount }),
  setPaymentMode: (mode) => set({ paymentMode: mode }),
  clearCart: () => set({ customerId: null, items: [], amountPaid: 0, paymentMode: 'cash' }),
}));
```

---

## 6. Form pattern — React Hook Form + Zod

```typescript
// Always use React Hook Form + Zod — never uncontrolled forms
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

// Define schema first
const productSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200),
  category: z.string().optional(),
  barcode: z.string().optional(),
  unit: z.enum(['pcs', 'kg', 'litre', 'pack', 'box']),
  gst_rate: z.number().min(0).max(28),
  selling_price: z.number().positive(),
  purchase_price: z.number().positive(),
  min_stock_alert: z.number().min(0),
});

type ProductFormValues = z.infer<typeof productSchema>;

// Inside component
const form = useForm<ProductFormValues>({
  resolver: zodResolver(productSchema),
  defaultValues: { unit: 'pcs', gst_rate: 0, min_stock_alert: 5 },
});

const onSubmit = async (values: ProductFormValues) => {
  await createProduct(values); // from useProducts hook
};
```

---

## 7. Currency & number formatting

**All money is in Indian Rupees (₹). Always use these formatters — never format inline.**

```typescript
// lib/formatters.ts

export const formatCurrency = (amount: number): string =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
  }).format(amount);
// Output: ₹1,23,456.78

export const formatDate = (iso: string): string =>
  new Intl.DateTimeFormat('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
  }).format(new Date(iso));
// Output: 05 Jun 2025

export const formatDateTime = (iso: string): string =>
  new Intl.DateTimeFormat('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  }).format(new Date(iso));

export const formatQuantity = (qty: number, unit: string): string =>
  `${qty % 1 === 0 ? qty.toFixed(0) : qty.toFixed(2)} ${unit}`;
// Output: "3 kg" or "1.50 litre"
```

---

## 8. Role-based rendering

```typescript
// hooks/useAuth.ts
import { useAuthStore } from '@/stores/auth.store';

export function useAuth() {
  const { user, token, logout } = useAuthStore();
  return {
    user,
    token,
    logout,
    isAdmin: user?.role === 'admin',
    isCashier: user?.role === 'cashier',
    isAuthenticated: !!token,
  };
}

// In components — always use this pattern for admin-only UI
const { isAdmin } = useAuth();
return (
  <div>
    <InvoiceList />
    {isAdmin && <DeleteButton />}
    {isAdmin && <StaffManagementLink />}
  </div>
);
```

---

## 9. Sync & offline pattern

```typescript
// hooks/useSync.ts
import { useState, useEffect } from 'react';
import api from '@dhanlekha/shared/api';
import { useSyncStore } from '@/stores/sync.store';

export function useSync() {
  const { isOnline, pendingCount, lastSyncAt, setOnline, setSyncStatus } = useSyncStore();

  useEffect(() => {
    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [setOnline]);

  const triggerSync = async () => {
    if (!isOnline) return;
    const { data } = await api.post('/sync/push');
    setSyncStatus(data);
  };

  return { isOnline, pendingCount, lastSyncAt, triggerSync };
}

// SyncIndicator component — shown on every authenticated screen
// Green dot = online+synced | Yellow = pending | Red = offline
```

---

## 10. Keyboard shortcuts — billing screen

The billing screen is the most keyboard-intensive. Register shortcuts via `lib/keyboard.ts`.

| Key           | Action                              |
|---------------|-------------------------------------|
| `F2`          | Focus product search input          |
| `F4`          | Focus customer search               |
| `F8`          | Open payment capture modal          |
| `F9`          | Save and print invoice              |
| `Escape`      | Close modal / cancel action         |
| `Enter`       | Add focused product to cart         |
| `Tab`         | Move to next field                  |
| `+` / `-`     | Increase / decrease item quantity   |
| `Delete`      | Remove focused cart item            |
| `Ctrl+Z`      | Remove last added item              |

---

## 11. Barcode scanner integration

```typescript
// hooks/useProducts.ts — barcode lookup
const lookupByBarcode = useCallback(async (barcode: string) => {
  // Barcode scanners emit the code then press Enter
  // Listen for rapid keystrokes ending in Enter with no focus on input
  const res = await api.get<{ data: Product & { inventory: Inventory } }>(
    `/products/barcode/${barcode}`
  );
  return res.data.data;
}, []);

// In ProductSearch component — detect scanner input
// Scanners type full barcode in < 50ms — distinguish from manual typing
useEffect(() => {
  let buffer = '';
  let lastKeyTime = 0;

  const handleKeyDown = (e: KeyboardEvent) => {
    const now = Date.now();
    if (now - lastKeyTime > 100) buffer = ''; // reset on slow typing
    lastKeyTime = now;

    if (e.key === 'Enter' && buffer.length > 3) {
      onBarcodeScanned(buffer);
      buffer = '';
    } else if (e.key.length === 1) {
      buffer += e.key;
    }
  };

  window.addEventListener('keydown', handleKeyDown);
  return () => window.removeEventListener('keydown', handleKeyDown);
}, [onBarcodeScanned]);
```

---

## 12. Electron IPC — print & sync

```typescript
// electron/preload.ts — expose safe IPC bridge
import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electron', {
  printInvoice: (invoiceId: string) =>
    ipcRenderer.invoke('print-invoice', invoiceId),
  triggerSync: () =>
    ipcRenderer.invoke('trigger-sync'),
  onSyncComplete: (cb: (result: SyncResult) => void) =>
    ipcRenderer.on('sync-complete', (_event, result) => cb(result)),
});

// In frontend component — use window.electron
declare global {
  interface Window {
    electron?: {
      printInvoice: (id: string) => Promise<void>;
      triggerSync: () => Promise<SyncResult>;
      onSyncComplete: (cb: (result: SyncResult) => void) => void;
    };
  }
}

const handlePrint = async () => {
  if (window.electron) {
    await window.electron.printInvoice(invoice.id);
  } else {
    window.print(); // web fallback
  }
};
```

---

## 13. Page checklist — before submitting any component

- [ ] All types imported from `@dhanlekha/shared/types`, not declared locally
- [ ] All API calls go through `@dhanlekha/shared/api` instance
- [ ] All API calls are inside a `use[Domain]()` hook, not in the component
- [ ] Loading and error states handled and displayed
- [ ] Empty state shown when list is empty (use `<EmptyState />`)
- [ ] Role check done for admin-only actions (`isAdmin && ...`)
- [ ] Money formatted with `formatCurrency()` from `lib/formatters.ts`
- [ ] Dates formatted with `formatDate()` from `lib/formatters.ts`
- [ ] Keyboard shortcuts work (especially on billing screen)
- [ ] `SyncIndicator` visible on authenticated layout (not per-page — already in shell)
- [ ] Form uses React Hook Form + Zod — no uncontrolled inputs
- [ ] No TypeScript `any` — use proper types or `unknown` with guards
- [ ] Mobile-responsive (Tailwind responsive classes where needed)

---

## 14. Reference files

Load these as needed — do not load all at once:

| File                              | Load when…                                       |
|-----------------------------------|--------------------------------------------------|
| `references/billing-screen.md`   | Building the invoice creation / billing UI       |
| `references/analytics-screen.md` | Building dashboard, charts, P&L screen           |
| `references/offline-sync.md`     | Building sync UI, offline queue, Electron IPC    |
| `references/ai-features-ui.md`   | Building voice billing, AI suggestions UI        |
| `references/design-tokens.md`    | Colors, spacing, typography, DhanLekha brand     |
| `references/component-library.md`| Reusable component API and usage examples        |