---
name: billing-logic
description: Defines billing, payment, and ledger workflows for the Antigravity ERP. Use when implementing or modifying any billing, payment, or ledger feature.
---

# Billing Logic Skill

Authoritative reference for all billing, payment, and financial logic in the Antigravity ERP.

---

## When to Use

- Creating or modifying invoice generation logic
- Implementing discount or offer application
- Calculating GST / tax amounts
- Recording payments and allocating to invoices
- Updating customer ledger or running balances
- Modifying inventory on sale or purchase

---

## Golden Rules

1. **Never trust frontend calculations** — all monetary math happens on the backend
2. **Every billing operation is an atomic transaction** — if any step fails, everything rolls back
3. **Ledger is the source of truth** for customer dues (not `customers.total_due`)
4. **`customers.total_due` is a cached denormalised value** — updated alongside ledger for display speed
5. **Snapshot prices at time of sale** — `invoice_items.unit_price` and `gst_rate` are frozen copies
6. **Use `decimal(10,2)` for money**, `decimal(10,3)` for quantities — never float

---

## Invoice Creation Workflow (Atomic Transaction)

```
BEGIN TRANSACTION

1. QUOTA CHECK
   → Check tenant_overrides → plan_features → usage_tracking
   → If used_count >= limit for 'max_invoices_per_month' → ABORT 403

2. INVOICE NUMBER
   → SELECT FOR UPDATE on invoice_sequences
   → Increment current_number → generate "INV-0043" format

3. LINE ITEMS — for each product:
   a. Fetch product.gst_rate, inventory.selling_price
   b. Check active offers (is_active, valid dates, applies_to match)
   c. Calculate:
      - line_subtotal = unit_price × quantity
      - line_after_discount = line_subtotal - discount_amount
      - gst_amount = line_after_discount × (gst_rate / 100)
      - line_total = line_after_discount + gst_amount
   d. INSERT invoice_items (snapshot unit_price, gst_rate)

4. INVOICE TOTALS
   → subtotal = SUM(unit_price × quantity)
   → discount_amount = SUM(item discounts) + invoice-level discount
   → tax_amount = SUM(gst amounts)
   → final_amount = subtotal - discount_amount + tax_amount
   → amount_due = final_amount - amount_paid

5. STATUS: paid | partial | unpaid based on amount_paid vs final_amount

6. INSERT invoices row

7. INVENTORY — for each item:
   → Decrement inventory.total_quantity
   → If batch tracking → FEFO consumption from inventory_batches
   → INSERT inventory_logs (change_type='sale', quantity_change=-N)

8. LEDGER
   → INSERT customer_ledger (entry_type='invoice', debit=final_amount)
   → running_balance = previous_balance + final_amount
   → UPDATE customers.total_due += final_amount

9. INCREMENT usage_tracking.used_count

10. INCREMENT offers.used_count (if offer applied)

COMMIT TRANSACTION
```

---

## GST Calculation

GST is calculated **after** discounts (per Indian GST law):

```
taxable_value = (unit_price × quantity) - discount_amount
gst_amount = taxable_value × (gst_rate / 100)
```

Supported rates: **0%, 5%, 12%, 18%, 28%**

`invoice_items.gst_rate` is a **snapshot** — old invoices retain their original rate even if the product rate changes.

---

## Discount Types (from offers table)

| Type       | Logic                                                    |
|------------|----------------------------------------------------------|
| flat       | Subtract `discount_value` from item price                |
| percentage | Subtract `(subtotal × discount_value / 100)`             |
| bogo       | Buy N get M free (N = discount_value)                    |
| bundle     | Fixed price for a group of items                         |

### Scope: `product`, `category`, `invoice`, `customer`

Rules:
- One offer per line item (choose best match)
- Check `max_uses` and `min_purchase_amount`
- Store `offer_id` on `invoice_items` for audit

---

## Payment Workflow (Atomic Transaction)

```
BEGIN TRANSACTION

1. INSERT payment (amount, unallocated_amount=amount, status='received')

2. ALLOCATE — for each invoice:
   → INSERT payment_allocations (payment_id, invoice_id, amount)
   → UPDATE invoices: amount_paid += X, amount_due -= X, status
   → Decrease payments.unallocated_amount

3. PAYMENT STATUS
   → unallocated_amount = 0 → 'fully_allocated'
   → unallocated_amount > 0 → 'partially_allocated' (advance credit)

4. LEDGER
   → INSERT customer_ledger (entry_type='payment', credit=allocated_total)
   → running_balance = previous_balance - credit
   → UPDATE customers.total_due -= allocated_total

COMMIT TRANSACTION
```

Advance payments: remaining `unallocated_amount` carries forward as credit.

---

## Ledger Rules

Append-only double-entry:

| Action     | Entry Type   | Debit          | Credit           | Balance Effect    |
|------------|-------------|----------------|------------------|-------------------|
| Invoice    | `invoice`   | final_amount   | 0                | Increases         |
| Payment    | `payment`   | 0              | allocated_amount | Decreases         |
| Adjustment | `adjustment`| correction     | correction       | Manual fix        |

```
running_balance = previous_entry.running_balance + debit - credit
```

Positive = customer owes. Negative = advance credit.

Verify integrity:
```sql
SELECT SUM(debit) - SUM(credit) FROM customer_ledger WHERE customer_id = ?
```
Must equal `customers.total_due`.

Nightly `ledger_snapshots` for fast historical queries and corruption recovery.

---

## Credit Limit Enforcement

Before creating a credit invoice:
```
new_due = customer.total_due + (final_amount - amount_paid)
IF new_due > customer.credit_limit AND credit_limit > 0 → REJECT 422
```

---

## Inventory Impact

| Event                | total_quantity | inventory_logs.change_type | quantity_change |
|----------------------|---------------|---------------------------|-----------------|
| Sale (invoice)       | Decrease      | `sale`                    | -N              |
| Purchase             | Increase      | `purchase`                | +N              |
| Manual adjustment    | Either        | `adjustment`              | ±N              |
| Invoice cancellation | Increase      | `return`                  | +N              |
| Waste/damage         | Decrease      | `waste`                   | -N              |

Low stock alert: if `total_quantity < min_stock_alert` → generate alert.

---

## Validation Checklist

- [ ] `final_amount = subtotal - discount_amount + tax_amount`
- [ ] `amount_due = final_amount - amount_paid`
- [ ] All money: 2 decimal places. All quantities: max 3.
- [ ] `gst_rate` ∈ {0, 5, 12, 18, 28}
- [ ] `running_balance` = previous + debit - credit
- [ ] `customers.total_due` matches latest `running_balance`
- [ ] `inventory.total_quantity >= 0` after deduction
- [ ] All operations inside a single transaction
- [ ] Prices are snapshots, not live references

---

## Common Pitfalls

1. Calculating GST before discount — WRONG
2. Using floats for money — WRONG
3. Updating ledger outside the invoice transaction — WRONG
4. Fetching price from products at report time instead of invoice_items — WRONG
5. Allowing negative stock — WRONG
6. Trusting frontend totals — WRONG
7. Forgetting usage_tracking increment — quota bypass
8. Forgetting offers.used_count increment — unlimited offer use
