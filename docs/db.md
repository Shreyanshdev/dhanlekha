# 🧾 ERP System — Database Design Documentation

## AI-Powered Offline ERP Billing System  
**Version 1.0 · Final Release**

---

##  Document Details

| Field | Description |
|------|-------------|
| **Document** | ERP Database ERD — Full Schema Reference |
| **Scope** | 25 core tables (Plans, Tenants, Billing, Inventory, Payments, Ledger, AI, Sync, Reporting) + Phase 4.5 premium-ERP extension schema (Accounting, GST, AP, Orders, Advanced Inventory, CRM, Platform — Section 17) |
| **Target DB** | SQLite (offline) + PostgreSQL (cloud sync) |
| **Audience** | Backend engineers, database architects, tech leads |

This document defines the complete database architecture for the **AI-powered offline-first ERP billing system**, including:

- 📦 Inventory & product tracking  
- 💳 Billing & payment flows  
- 📊 Ledger & financial tracking  
- 🧠 AI & analytics modules  
- 🔄 Offline sync architecture  

---

> 💡 **Design Principle:**  
> Every table is **multi-tenant by design**, ensuring:
> - Complete data isolation  
> - Scalable SaaS architecture  
> - Secure multi-shop support  

---

##  Key Highlights

- ⚡ Offline-first (UUID-based inserts)  
- 🔐 Multi-tenant secure schema  
- 📈 Scalable to thousands of shops  
- 🧠 AI-ready data structure  
- 🔄 Sync-ready with conflict resolution  

---


# **1. Overview**
This document is the authoritative reference for the database schema powering the AI-Powered Offline ERP Billing System. It covers all 25 tables, every field, all foreign key relationships, indexing strategy, and the reasoning behind each design decision.

|*Design principle: every table is multi-tenant from the start. All business data carries tenant\_id so a single database instance can serve thousands of shops safely, with zero data leakage between vendors.*|
| :- |

## **1.1 Table Groups at a Glance**

|**Group**|**Tables**|**Purpose**|
| :- | :- | :- |
|Plans & Subscriptions|plans, plan\_features, feature\_flags, subscriptions, tenant\_overrides, usage\_tracking|SaaS billing, feature gating, quota enforcement|
|Tenant & Users|tenants, users, settings, invoice\_sequences|Shop identity, staff, configuration, invoice numbering|
|People|customers, suppliers|Buyers and stock suppliers|
|Products & Inventory|products, inventory, inventory\_batches, inventory\_logs|Catalogue, stock levels, batch tracking, audit log|
|Offers & Discounts|offers|Mall-style promotions, BOGO, bundle deals|
|Billing|invoices, invoice\_items|Core sales transactions|
|Payments|payments, payment\_allocations|Cash received, UPI, multi-invoice settlement|
|Ledger|customer\_ledger, ledger\_snapshots|Udhaar tracking, running balance, recovery snapshots|
|Purchases|purchases, purchase\_items|Stock-in from suppliers|
|Expenses|expenses|Shop operating costs|
|System|alerts, sync\_queue, daily\_metrics, product\_ai\_data|Notifications, offline sync, reporting, AI enrichment|

### **1.2 Multi-Branch Architecture**
The system uses a **1 Tenant = N Branches** model. 
- **Shared**: Products catalog, customers, suppliers, settings, and subscription limits are scoped to `tenant_id` and shared across all branches.
- **Isolated**: Inventory stock levels, prices, invoices, purchases, and expenses are scoped to `branch_id`.
- **Users**: Cashiers are assigned to a specific `branch_id`. Admins can access all branches.


# **2. Global Conventions**
## **2.1 Primary Keys**
Every table uses uuid as its primary key. UUIDs are generated on the client device before the record is saved, which is essential for offline-first operation — the app does not need a server round-trip to get an ID before inserting a row.
## **2.2 Soft Deletes**
Critical tables use a deleted\_at timestamp instead of physically removing rows. This means:

- Historical invoices and payments are never lost
- You can restore accidentally deleted customers or products
- All queries must include WHERE deleted\_at IS NULL in their default scope

|*Tables with soft delete: tenants, users, customers, suppliers, products, invoices, payments, purchases, expenses, offers.*|
| :- |
## **2.3 Timestamps**
Every table carries created\_at. Tables that allow edits also carry updated\_at. These are set automatically by the application layer and are used by the sync engine for conflict resolution.
## **2.4 Naming Conventions**

|**Convention**|**Example**|
| :- | :- |
|snake\_case for all names|invoice\_items, tenant\_id|
|FK columns end in \_id|tenant\_id, customer\_id, product\_id|
|Boolean columns start with is\_|is\_active, is\_read, is\_synced, is\_enabled|
|Soft-delete column|deleted\_at (nullable timestamp)|
|Enum-style string columns|status, role, action, change\_type|


# **3. Plans & Subscriptions**
This group of six tables forms the SaaS backbone. It controls what each tenant can do, how much they can use, and what they have paid. Designed so that adding a new plan or a new feature gate never requires a code change — only a database row.
### **3.1  plans**
Stores the subscription tiers offered to vendors. Currently: Starter (free), Growth (₹499/month), Enterprise (₹1,199/month).

|**Field Name**|**Type**|**Constraint**|**Description**|
| :- | :- | :- | :- |
|**id**|uuid|PK|Unique identifier for the plan|
|**name**|string|NOT NULL|Display name shown to vendor — e.g. 'Growth'|
|**slug**|string|UNIQUE|URL-safe identifier — e.g. 'growth'. Used in code checks|
|**monthly\_price**|decimal(10,2)|NOT NULL|Price in INR for monthly billing cycle|
|**annual\_price**|decimal(10,2)|NOT NULL|Price in INR for annual billing (typically 20% discount)|
|**is\_active**|boolean|DEFAULT true|Set false to retire a plan without deleting it|
|**created\_at**|timestamp|NOT NULL|When this plan was first created|

|*Business rule: a tenant on an inactive plan keeps their access until plan\_expires\_at. New signups cannot choose an inactive plan.*|
| :- |
### **3.2  feature\_flags**
Master registry of every feature in the system that can be switched on or off, or limited by quota. Adding a new feature gate means adding one row here — no schema change required.

|**Field Name**|**Type**|**Constraint**|**Description**|
| :- | :- | :- | :- |
|**id**|uuid|PK|Unique identifier|
|**feature\_key**|string|UNIQUE NOT NULL|Machine-readable key — e.g. 'max\_invoices\_per\_month', 'ai\_voice\_billing'|
|**display\_name**|string|NOT NULL|Human-readable name for admin dashboards|
|**description**|text|nullable|Explains what this feature does and what the limit means|
|**category**|string|NOT NULL|Groups features — e.g. 'billing', 'ai', 'inventory', 'reporting'|
|**created\_at**|timestamp|NOT NULL|When this feature was registered|

**Sample feature keys**

|**feature\_key**|**Type**|**Meaning**|
| :- | :- | :- |
|max\_invoices\_per\_month|quota|Max invoices a tenant can raise in a calendar month|
|max\_products|quota|Max active products in catalogue|
|max\_staff\_users|quota|Max user accounts (excluding owner)|
|cloud\_sync|toggle|Whether cloud backup and sync is enabled|
|ai\_voice\_billing|toggle|Convert speech to invoice items|
|ai\_demand\_prediction|toggle|Demand forecasting and low-stock prediction|
|max\_branches|quota|Number of shop branches (multi-location)|
|gst\_filing\_integration|toggle|Direct GST portal filing (Enterprise only)|
### **3.3  plan\_features**
Maps each plan to its allowed feature set. One row per plan-feature pair. This is the table your backend checks before allowing any action.

|**Field Name**|**Type**|**Constraint**|**Description**|
| :- | :- | :- | :- |
|**id**|uuid|PK|Unique identifier|
|**plan\_id**|uuid|FK → plans.id|Which plan this row configures|
|**feature\_key**|string|FK → feature\_flags.feature\_key|Which feature is being configured|
|**feature\_type**|string|NOT NULL|'quota' or 'toggle' — drives how limit\_value is interpreted|
|**limit\_value**|integer|nullable|For quota features: the hard limit. -1 means unlimited. NULL for toggle features|
|**is\_enabled**|boolean|NOT NULL|For toggle features: whether it is on or off. For quota: always true|

|*Enforcement logic: before creating an invoice, the backend queries plan\_features for max\_invoices\_per\_month, then queries usage\_tracking for this tenant's current month count. If used\_count >= limit\_value, the action is blocked with a plan upgrade prompt.*|
| :- |
### **3.4  subscriptions**
Complete payment history for every tenant. Every successful payment — monthly renewal, annual upgrade, plan change — creates a new row. This is your billing audit trail.

|**Field Name**|**Type**|**Constraint**|**Description**|
| :- | :- | :- | :- |
|**id**|uuid|PK|Unique identifier|
|**tenant\_id**|uuid|FK → tenants.id|Which shop made this payment|
|**plan\_id**|uuid|FK → plans.id|Which plan was purchased|
|**billing\_cycle**|string|NOT NULL|'monthly' or 'annual'|
|**amount\_paid**|decimal(10,2)|NOT NULL|Actual INR amount received|
|**payment\_mode**|string|NOT NULL|'upi', 'card', 'bank\_transfer', 'manual'|
|**payment\_ref**|string|nullable|UPI transaction ID, Razorpay order ID, or bank reference|
|**status**|string|NOT NULL|'active', 'expired', 'cancelled', 'refunded'|
|**starts\_at**|date|NOT NULL|When this subscription period begins|
|**ends\_at**|date|NOT NULL|When this subscription period ends|
|**created\_at**|timestamp|NOT NULL|Payment timestamp|
### **3.5  tenant\_overrides**
Allows giving a specific tenant custom limits or features without changing their plan. Used for sales deals, beta access, or Enterprise custom contracts. Overrides take priority over plan\_features during enforcement checks.

|**Field Name**|**Type**|**Constraint**|**Description**|
| :- | :- | :- | :- |
|**id**|uuid|PK|Unique identifier|
|**tenant\_id**|uuid|FK → tenants.id|Which tenant gets the override|
|**feature\_key**|string|FK → feature\_flags.feature\_key|Which feature is overridden|
|**feature\_type**|string|NOT NULL|'quota' or 'toggle'|
|**limit\_value**|integer|nullable|Override quota value. -1 means unlimited|
|**is\_enabled**|boolean|nullable|Override toggle state|
|**reason**|string|NOT NULL|Why this override was granted — mandatory for audit|
|**expires\_at**|timestamp|nullable|Auto-expiry. NULL means permanent until manually removed|
|**created\_at**|timestamp|NOT NULL|When this override was granted|
### **3.6  usage\_tracking**
Tracks real-time consumption of quota-type features per tenant per billing period. Incremented on every relevant action and reset monthly by a scheduled job.

|**Field Name**|**Type**|**Constraint**|**Description**|
| :- | :- | :- | :- |
|**id**|uuid|PK|Unique identifier|
|**tenant\_id**|uuid|FK → tenants.id|Which shop|
|**feature\_key**|string|FK → feature\_flags.feature\_key|Which quota feature is being tracked|
|**used\_count**|integer|DEFAULT 0|Current usage count for the active period|
|**period**|string|NOT NULL|Billing period — format 'YYYY-MM' e.g. '2025-06'|
|**reset\_at**|timestamp|nullable|When this counter was last reset to zero|
|**updated\_at**|timestamp|NOT NULL|Last increment timestamp|

|*Enforcement order: (1) Check tenant\_overrides for this feature key. (2) If override exists and is not expired, use it. (3) Otherwise, check plan\_features for the tenant's active plan. (4) Compare against usage\_tracking.used\_count.*|
| :- |


# **4. Tenant & Users**
### **4.1  tenants**
The root entity of the entire system. Every single piece of business data belongs to a tenant. A tenant represents one shop or business.

|**Field Name**|**Type**|**Constraint**|**Description**|
| :- | :- | :- | :- |
|**id**|uuid|PK|Unique identifier|
|**name**|string|NOT NULL|Shop or business name — e.g. 'Sharma Kirana Store'|
|**phone**|string|NOT NULL UNIQUE|Primary contact. Used for login and WhatsApp alerts|
|**gst\_number**|string|nullable|15-character GSTIN. Optional for unregistered dealers|
|**address**|text|nullable|Full shop address for invoice headers|
|**plan\_id**|uuid|FK → plans.id|Currently active subscription plan|
|**plan\_status**|string|NOT NULL|'trial', 'active', 'expired', 'cancelled'|
|**trial\_ends\_at**|date|nullable|When the 14-day trial expires. NULL if trial already ended|
|**plan\_expires\_at**|date|nullable|When the paid subscription expires|
|**created\_at**|timestamp|NOT NULL|When this shop registered|
|**updated\_at**|timestamp|NOT NULL|Last profile update|
|**deleted\_at**|timestamp|nullable|Soft delete — set when shop account is closed|

### **4.2  branches**
Physical store locations or distinct branches under one tenant. Allows isolated inventory and billing.

|**Field Name**|**Type**|**Constraint**|**Description**|
| :- | :- | :- | :- |
|**id**|uuid|PK|Unique identifier|
|**tenant\_id**|uuid|FK → tenants.id|Which shop this branch belongs to|
|**name**|string|NOT NULL|Branch name — e.g. 'Kanpur Main Store'|
|**address**|text|nullable|Branch specific address|
|**phone**|string|nullable|Branch contact number|
|**is\_active**|boolean|DEFAULT true|Set false to disable operations at this branch|
|**created\_at**|timestamp|NOT NULL|When this branch was added|
|**deleted\_at**|timestamp|nullable|Soft delete|

### **4.3  users**
Staff accounts within a shop. The owner is role='admin'. Cashiers are role='cashier'. All actions (invoice creation, stock updates, expense recording) are tied to a user for full accountability.

|**Field Name**|**Type**|**Constraint**|**Description**|
| :- | :- | :- | :- |
|**id**|uuid|PK|Unique identifier|
|**tenant\_id**|uuid|FK → tenants.id|Which shop this staff member belongs to|
|**branch_id**|uuid|FK → branches.id|Which branch this cashier works at (nullable for admins)|
|**name**|string|NOT NULL|Full name|
|**role**|string|NOT NULL|'admin' (full access) or 'cashier' (billing only)|
|**password\_hash**|string|NOT NULL|bcrypt hash. Never stored in plain text|
|**is\_active**|boolean|DEFAULT true|Set false to deactivate without deleting|
|**created\_by**|uuid|FK → users.id|Which admin created this account — audit trail|
|**last\_login\_at**|timestamp|nullable|Last successful login — useful for inactive account detection|
|**created\_at**|timestamp|NOT NULL|Account creation time|
|**deleted\_at**|timestamp|nullable|Soft delete when staff leaves|

|*Role permissions: admin can access all modules including reports, settings, and user management. cashier can only create invoices, accept payments, and view their own today's sales.*|
| :- |
### **4.4  invoice\_sequences**
Solves the invoice number duplication problem. Each tenant owns exactly one row here. The backend locks this row (SELECT FOR UPDATE), reads current\_number, increments it, generates the invoice number (e.g. INV-0042), saves the invoice, then releases the lock — guaranteeing uniqueness even with multiple concurrent cashiers.

|**Field Name**|**Type**|**Constraint**|**Description**|
| :- | :- | :- | :- |
|**id**|uuid|PK|Unique identifier|
|**tenant\_id**|uuid|FK → tenants.id|Which tenant this counter belongs to|
|**branch\_id**|uuid|FK → branches.id UNIQUE|One sequence per branch — enforced by UNIQUE constraint|
|**prefix**|string|DEFAULT 'INV'|Configurable prefix — vendor can change to 'BILL', 'KNP-INV', etc.|
|**current\_number**|integer|DEFAULT 0|Last used number. Next invoice gets current\_number + 1|
|**updated\_at**|timestamp|NOT NULL|Timestamp of last number increment|

|*Generated format: {prefix}-{current\_number padded to 4 digits}. Example: INV-0001, INV-0042, BILL-0153. Padding width is configurable in settings.*|
| :- |
### **4.5  settings**
Per-tenant key-value configuration store. Allows each shop to customize behaviour without schema changes. Example keys: invoice\_prefix, gst\_inclusive, currency\_symbol, low\_stock\_threshold\_default.

|**Field Name**|**Type**|**Constraint**|**Description**|
| :- | :- | :- | :- |
|**id**|uuid|PK|Unique identifier|
|**tenant\_id**|uuid|FK → tenants.id|Which shop owns this setting|
|**key**|string|NOT NULL|Setting name — e.g. 'invoice\_prefix'|
|**value**|text|NOT NULL|Setting value — always stored as string, cast in application layer|
|**updated\_at**|timestamp|NOT NULL|Last time this setting was changed|


# **5. Customers & Suppliers**
### **5.1  customers**
Represents every person or business that buys from the shop. Tracks credit (udhaar) at the customer level for quick balance display. The precise transaction history lives in customer\_ledger.

|**Field Name**|**Type**|**Constraint**|**Description**|
| :- | :- | :- | :- |
|**id**|uuid|PK|Unique identifier|
|**tenant\_id**|uuid|FK → tenants.id|Which shop this customer belongs to|
|**name**|string|NOT NULL|Customer full name|
|**phone**|string|nullable|Mobile number — used for WhatsApp payment reminders|
|**address**|text|nullable|Delivery or billing address|
|**credit\_limit**|decimal(10,2)|DEFAULT 0|Maximum udhaar allowed. 0 means no credit permitted|
|**total\_due**|decimal(10,2)|DEFAULT 0|Denormalised running balance. Updated on every invoice and payment for fast display. Source of truth is customer\_ledger|
|**created\_at**|timestamp|NOT NULL|When customer was added|
|**updated\_at**|timestamp|NOT NULL|Last edit|
|**deleted\_at**|timestamp|nullable|Soft delete — preserves ledger and invoice history|

|*total\_due is a cached value for performance. If it ever drifts out of sync, recalculate as: SUM(debit) - SUM(credit) from customer\_ledger WHERE customer\_id = this customer.*|
| :- |
### **5.2  suppliers**
Businesses or individuals who supply stock to the shop. Linked to purchases to track who delivered what, at what price.

|**Field Name**|**Type**|**Constraint**|**Description**|
| :- | :- | :- | :- |
|**id**|uuid|PK|Unique identifier|
|**tenant\_id**|uuid|FK → tenants.id|Which shop manages this supplier|
|**name**|string|NOT NULL|Supplier company or person name|
|**phone**|string|nullable|Contact number|
|**address**|text|nullable|Supplier's address|
|**gst\_number**|string|nullable|Supplier's GSTIN — needed for purchase invoice GST credit claims|
|**created\_at**|timestamp|NOT NULL|When supplier was added|
|**deleted\_at**|timestamp|nullable|Soft delete|


# **6. Products & Inventory**
The product system is deliberately split into three layers: the catalogue (what you sell), the summary stock (how much you have), and the batch stock (which specific batch it came from). This allows simple shops to use just the first two layers while pharma and FMCG shops use all three.
### **6.1  products**
The product catalogue. Contains descriptive information about what the shop sells. Does not contain stock levels — those live in inventory.

|**Field Name**|**Type**|**Constraint**|**Description**|
| :- | :- | :- | :- |
|**id**|uuid|PK|Unique identifier|
|**tenant\_id**|uuid|FK → tenants.id|Which shop owns this product|
|**name**|string|NOT NULL|Product name — e.g. 'Amul Milk 1L'|
|**category**|string|nullable|Product category — e.g. 'Dairy', 'Snacks', 'Stationery'|
|**barcode**|string|nullable|EAN-13 or QR code. Indexed for fast scanner lookup|
|**unit**|string|NOT NULL|Unit of sale — e.g. 'pcs', 'kg', 'litre', 'pack'|
|**gst\_rate**|decimal(5,2)|DEFAULT 0|GST percentage applicable — e.g. 5.00, 12.00, 18.00|
|**created\_at**|timestamp|NOT NULL|When product was added|
|**updated\_at**|timestamp|NOT NULL|Last edit|
|**deleted\_at**|timestamp|nullable|Soft delete — historical invoices still reference this product|
### **6.2  inventory**
Summary stock table. One row per product. Gives the quick answer to 'how many of this product do I have right now?' and 'what price should I sell it at?'

|**Field Name**|**Type**|**Constraint**|**Description**|
| :- | :- | :- | :- |
|**id**|uuid|PK|Unique identifier|
|**tenant_id**|uuid|FK → tenants.id|Tenant isolation|
|**branch_id**|uuid|FK → branches.id|Which branch this stock belongs to|
|**product_id**|uuid|FK → products.id|Which product|
|*(Composite Unique)*| |UNIQUE(branch_id, product_id)|One inventory row per product per branch|
|**total_quantity**|decimal(10,3)|DEFAULT 0|Current stock. Decremented on sales, incremented on purchases|
|**purchase\_price**|decimal(10,2)|NOT NULL|Latest purchase cost — used for profit calculation|
|**selling\_price**|decimal(10,2)|NOT NULL|Default selling price. Can be overridden per invoice item|
|**min\_stock\_alert**|decimal(10,3)|DEFAULT 0|Alert fires when total\_quantity drops below this threshold|
|**updated\_at**|timestamp|NOT NULL|Last stock movement timestamp|
### **6.3  inventory\_batches**
Optional batch-level tracking. Each purchase can create a new batch with its own quantity, price, and expiry date. Used by FMCG and pharma shops. When a product is sold, the oldest non-expired batch is consumed first (FEFO — First Expiry First Out).

|**Field Name**|**Type**|**Constraint**|**Description**|
| :- | :- | :- | :- |
|**id**|uuid|PK|Unique identifier|
|**product_id**|uuid|FK → products.id|Which product this batch belongs to|
|**branch_id**|uuid|FK → branches.id|Which branch holds this batch|
|**quantity**|decimal(10,3)|NOT NULL|Remaining quantity in this batch|
|**purchase\_price**|decimal(10,2)|NOT NULL|What was paid for this specific batch|
|**selling\_price**|decimal(10,2)|NOT NULL|Recommended selling price for this batch|
|**expiry\_date**|date|nullable|Expiry date — NULL for products that do not expire|
|**batch\_code**|string|nullable|Manufacturer's batch number — printed on packaging|
|**created\_at**|timestamp|NOT NULL|When this batch was received (purchase date)|
### **6.4  inventory\_logs**
Immutable audit trail of every stock movement. Never updated — only appended. Allows reconstructing stock levels at any point in history.

|**Field Name**|**Type**|**Constraint**|**Description**|
| :- | :- | :- | :- |
|**id**|uuid|PK|Unique identifier|
|**product_id**|uuid|FK → products.id|Which product moved|
|**branch_id**|uuid|FK → branches.id|Which branch recorded movement|
|**user_id**|uuid|FK → users.id|Which staff member triggered this movement|
|**change\_type**|string|NOT NULL|'sale', 'purchase', 'adjustment', 'return', 'waste'|
|**quantity\_change**|decimal(10,3)|NOT NULL|Positive for stock-in, negative for stock-out|
|**reference\_id**|uuid|nullable|Links to the source document: invoice\_id for sales, purchase\_id for purchases|
|**note**|text|nullable|Free text explanation — required for 'adjustment' and 'waste' types|
|**created\_at**|timestamp|NOT NULL|When this movement happened|


# **7. Offers & Discounts**
The offers system handles how malls and modern retail stores manage promotions. One table covers all offer types. The billing engine checks for applicable active offers when adding items to an invoice and auto-applies the best match.
### **7.1  offers**

|**Field Name**|**Type**|**Constraint**|**Description**|
| :- | :- | :- | :- |
|**id**|uuid|PK|Unique identifier|
|**tenant_id**|uuid|FK → tenants.id|Which shop created this offer|
|**branch_id**|uuid|FK → branches.id (nullable)|If null, applies to all branches. If set, applies to specific branch|
|**name**|string|NOT NULL|Offer display name — e.g. '10% off Dairy', 'Buy 2 Get 1 Free'|
|**offer\_type**|string|NOT NULL|'flat', 'percentage', 'bogo', 'bundle' — see table below|
|**discount\_value**|decimal(10,2)|NOT NULL|The discount amount or percentage. Meaning depends on offer\_type|
|**applies\_to**|string|NOT NULL|'product', 'category', 'invoice', 'customer' — scope of the offer|
|**applies\_to\_id**|uuid|nullable|The specific product or customer the offer targets. NULL when applies\_to is 'invoice' or 'category' by name|
|**min\_purchase\_amount**|decimal(10,2)|DEFAULT 0|Minimum invoice value before offer activates. 0 means no minimum|
|**max\_uses**|integer|nullable|Total redemption cap across all customers. NULL means unlimited|
|**used\_count**|integer|DEFAULT 0|How many times this offer has been applied so far|
|**valid\_from**|date|NOT NULL|Offer start date — inclusive|
|**valid\_until**|date|NOT NULL|Offer end date — inclusive|
|**is\_active**|boolean|DEFAULT true|Manual kill switch — set false to pause an offer immediately|
|**created\_at**|timestamp|NOT NULL|When the offer was created|
|**deleted\_at**|timestamp|nullable|Soft delete|

**Offer types explained**

|**offer\_type**|**discount\_value means**|**Example**|
| :- | :- | :- |
|flat|Fixed INR off|₹20 off on Parle-G 800g|
|percentage|Percent off item price|10% off all Dairy products|
|bogo|Buy N get M free (N stored in discount\_value)|Buy 2 Get 1 Free — Pepsi 2L|
|bundle|Fixed price for a group|Any 3 chocolates for ₹50|

|*Billing engine rule: when a cashier adds a product to an invoice, the engine queries offers WHERE is\_active=true AND valid\_from <= today AND valid\_until >= today AND (applies\_to='product' AND applies\_to\_id=product\_id OR applies\_to='category' AND ...). The matched offer's id is stored in invoice\_items.offer\_id and the discount is calculated and stored in invoice\_items.discount\_amount.*|
| :- |


# **8. Billing — Invoices**
### **8.1  invoices**
The central transaction table of the ERP. Every sale creates one invoice. The invoice header stores totals; the line items live in invoice\_items.

|**Field Name**|**Type**|**Constraint**|**Description**|
| :- | :- | :- | :- |
|**id**|uuid|PK|Unique identifier|
|**tenant_id**|uuid|FK → tenants.id|Which shop raised this invoice|
|**branch_id**|uuid|FK → branches.id|Which store raised this invoice|
|**customer\_id**|uuid|FK → customers.id|The buyer. Can be linked to a walk-in anonymous customer record|
|**created\_by**|uuid|FK → users.id|Which cashier or admin created this invoice|
|**invoice\_number**|string|NOT NULL|Human-readable number — e.g. INV-0042. Generated via invoice\_sequences|
|**subtotal**|decimal(10,2)|NOT NULL|Sum of all line item totals before tax|
|**tax\_amount**|decimal(10,2)|NOT NULL|Total GST collected across all line items|
|**discount\_amount**|decimal(10,2)|DEFAULT 0|Total discount applied — sum of all offer discounts plus manual discount|
|**final\_amount**|decimal(10,2)|NOT NULL|Amount customer owes: subtotal + tax\_amount - discount\_amount|
|**amount\_paid**|decimal(10,2)|DEFAULT 0|Amount received at time of billing|
|**amount\_due**|decimal(10,2)|NOT NULL|Outstanding balance: final\_amount - amount\_paid|
|**status**|string|NOT NULL|'paid', 'partial', 'unpaid', 'cancelled'|
|**note**|text|nullable|Optional note from cashier — e.g. 'customer requested delivery'|
|**created\_at**|timestamp|NOT NULL|Invoice creation time|
|**updated\_at**|timestamp|NOT NULL|Last modification — e.g. when a payment is received|
|**deleted\_at**|timestamp|nullable|Soft delete — cancelled invoices are never hard deleted|
### **8.2  invoice\_items**
One row per product line on an invoice. Stores the price and GST at the time of sale — not fetched from products at report time, because prices change over time.

|**Field Name**|**Type**|**Constraint**|**Description**|
| :- | :- | :- | :- |
|**id**|uuid|PK|Unique identifier|
|**invoice\_id**|uuid|FK → invoices.id|Parent invoice|
|**product\_id**|uuid|FK → products.id|Which product was sold|
|**batch\_id**|uuid|FK → inventory\_batches.id (nullable)|Which batch was consumed. NULL if batch tracking not used|
|**quantity**|decimal(10,3)|NOT NULL|Quantity sold — decimal supports kg, litre, etc.|
|**unit\_price**|decimal(10,2)|NOT NULL|Price per unit at time of sale. Snapshot — never changes|
|**gst\_rate**|decimal(5,2)|NOT NULL|GST rate at time of sale. Snapshot — never changes|
|**discount\_amount**|decimal(10,2)|DEFAULT 0|Discount applied to this line item from an offer|
|**offer\_id**|uuid|FK → offers.id (nullable)|Which offer provided the discount. NULL if no offer applied|
|**total**|decimal(10,2)|NOT NULL|(unit\_price x quantity) - discount\_amount + GST amount|


# **9. Payments**
The payment system is deliberately decoupled from invoices. A payment is first recorded as received money, then allocated to one or more invoices. This supports advance payments, partial settlements, and bulk clearing — all common in Indian retail.
### **9.1  payments**
Records cash or digital money received from a customer. Does not directly reference an invoice. The link to invoices is made through payment\_allocations.

|**Field Name**|**Type**|**Constraint**|**Description**|
| :- | :- | :- | :- |
|**id**|uuid|PK|Unique identifier|
|**tenant\_id**|uuid|FK → tenants.id|Which shop received this payment|
|**customer\_id**|uuid|FK → customers.id|Who paid|
|**amount**|decimal(10,2)|NOT NULL|Total amount received in this transaction|
|**unallocated\_amount**|decimal(10,2)|DEFAULT 0|Advance credit balance — portion not yet linked to any invoice|
|**payment\_mode**|string|NOT NULL|'cash', 'upi', 'card', 'bank\_transfer', 'cheque'|
|**reference\_note**|string|nullable|UPI transaction ID, cheque number, card last 4 digits|
|**status**|string|NOT NULL|'received', 'partially\_allocated', 'fully\_allocated'|
|**created\_at**|timestamp|NOT NULL|When payment was received|
|**deleted\_at**|timestamp|nullable|Soft delete — only for accidental entry reversal|
### **9.2  payment\_allocations**
The bridge between payments and invoices. One payment can clear multiple invoices. One invoice can be cleared by multiple payments. This join table records each partial settlement.

|**Field Name**|**Type**|**Constraint**|**Description**|
| :- | :- | :- | :- |
|**id**|uuid|PK|Unique identifier|
|**payment\_id**|uuid|FK → payments.id|Which payment is being allocated|
|**invoice\_id**|uuid|FK → invoices.id|Which invoice is being cleared (partially or fully)|
|**amount**|decimal(10,2)|NOT NULL|How much of the payment is applied to this invoice|
|**created\_at**|timestamp|NOT NULL|When this allocation was made|

|*Example: Customer pays ₹2,000. They owe ₹1,200 on invoice INV-0038 and ₹600 on INV-0039. Create one payment row (amount=2000), then two allocation rows: (payment, INV-0038, 1200) and (payment, INV-0039, 600). The remaining ₹200 sits in payments.unallocated\_amount as advance credit.*|
| :- |


# **10. Customer Ledger**
The ledger is the financial backbone of the udhaar system. It follows double-entry accounting principles — every financial event appends a new row rather than updating an existing balance. This makes the ledger tamper-evident and fully auditable.
### **10.1  customer\_ledger**

|**Field Name**|**Type**|**Constraint**|**Description**|
| :- | :- | :- | :- |
|**id**|uuid|PK|Unique identifier|
|**tenant\_id**|uuid|FK → tenants.id|Which shop's ledger this entry belongs to|
|**customer\_id**|uuid|FK → customers.id|Which customer's account|
|**entry\_type**|string|NOT NULL|'invoice' (customer owes), 'payment' (customer paid), 'adjustment' (manual correction)|
|**reference\_id**|uuid|NOT NULL|The invoice\_id or payment\_id that caused this entry|
|**debit**|decimal(10,2)|DEFAULT 0|Amount added to what customer owes — triggered by invoices|
|**credit**|decimal(10,2)|DEFAULT 0|Amount subtracted from what customer owes — triggered by payments|
|**running\_balance**|decimal(10,2)|NOT NULL|Balance after this entry. Positive = customer owes money|
|**created\_at**|timestamp|NOT NULL|When this entry was created — immutable after creation|

|*The running\_balance is computed at insert time as: previous\_entry.running\_balance + debit - credit. It is a convenience field. If it ever needs verification, recalculate from scratch: SELECT SUM(debit) - SUM(credit) FROM customer\_ledger WHERE customer\_id = X ORDER BY created\_at.*|
| :- |
### **10.2  ledger\_snapshots**
Daily closing balance snapshots per customer. Generated by a nightly batch job. Serves two purposes: (1) fast report queries — 'what was this customer's balance on 1st June?' reads from snapshots instead of replaying the full ledger. (2) Recovery — if running\_balance corruption is detected, reconstruct from the last valid snapshot plus subsequent entries only.

|**Field Name**|**Type**|**Constraint**|**Description**|
| :- | :- | :- | :- |
|**id**|uuid|PK|Unique identifier|
|**tenant\_id**|uuid|FK → tenants.id|Which shop|
|**customer\_id**|uuid|FK → customers.id|Which customer|
|**closing\_balance**|decimal(10,2)|NOT NULL|Balance at end of snapshot\_date|
|**snapshot\_date**|date|NOT NULL|The date this closing balance represents|
|**created\_at**|timestamp|NOT NULL|When this snapshot was generated|


# **11. Purchases & Expenses**
### **11.1  purchases**
Records stock received from suppliers. Creating a purchase automatically increments inventory.total\_quantity and appends inventory\_logs entries via application logic (or a database trigger).

|**Field Name**|**Type**|**Constraint**|**Description**|
| :- | :- | :- | :- |
|**id**|uuid|PK|Unique identifier|
|**tenant_id**|uuid|FK → tenants.id|Which shop made this purchase|
|**branch_id**|uuid|FK → branches.id|Which store received stock|
|**supplier\_id**|uuid|FK → suppliers.id|Who supplied the stock|
|**total\_amount**|decimal(10,2)|NOT NULL|Total amount paid to supplier for this purchase|
|**status**|string|NOT NULL|'received', 'partial', 'pending'|
|**created\_at**|timestamp|NOT NULL|Date of purchase|
|**deleted\_at**|timestamp|nullable|Soft delete|
### **11.2  purchase\_items**
Line items within a purchase. Each row is one product received in one purchase.

|**Field Name**|**Type**|**Constraint**|**Description**|
| :- | :- | :- | :- |
|**id**|uuid|PK|Unique identifier|
|**purchase\_id**|uuid|FK → purchases.id|Parent purchase document|
|**product\_id**|uuid|FK → products.id|Which product was received|
|**quantity**|decimal(10,3)|NOT NULL|Quantity received|
|**purchase\_price**|decimal(10,2)|NOT NULL|Price paid per unit in this purchase — snapshot|
|**total**|decimal(10,2)|NOT NULL|quantity x purchase\_price|
### **11.3  expenses**
Tracks shop operating costs — rent, electricity, wages, packaging, transport. Included in profit calculations: Net Profit = Total Sales Revenue - Cost of Goods Sold - Total Expenses.

|**Field Name**|**Type**|**Constraint**|**Description**|
| :- | :- | :- | :- |
|**id**|uuid|PK|Unique identifier|
|**tenant_id**|uuid|FK → tenants.id|Which shop incurred this expense|
|**branch_id**|uuid|FK → branches.id|Which store incurred it|
|**recorded_by**|uuid|FK → users.id|Which staff member logged it — accountability|
|**category**|string|NOT NULL|'rent', 'electricity', 'wages', 'packaging', 'transport', 'other'|
|**amount**|decimal(10,2)|NOT NULL|Amount spent in INR|
|**note**|text|nullable|Description — e.g. 'August electricity bill'|
|**payment\_mode**|string|NOT NULL|'cash', 'upi', 'bank\_transfer'|
|**created\_at**|timestamp|NOT NULL|Date expense was incurred|
|**deleted\_at**|timestamp|nullable|Soft delete|


# **12. System Tables**
### **12.1  alerts**
Stores notifications generated by the system for the vendor to act on. Generated by background jobs monitoring inventory levels, payment dues, and demand spikes.

|**Field Name**|**Type**|**Constraint**|**Description**|
| :- | :- | :- | :- |
|**id**|uuid|PK|Unique identifier|
|**tenant_id**|uuid|FK → tenants.id|Which shop this alert is for|
|**branch_id**|uuid|FK → branches.id|Which branch this alert concerns|
|**alert_type**|string|NOT NULL|'low_stock', 'payment_due', 'high_demand', 'expiry_soon', 'sync_failed'|
|**message**|text|NOT NULL|Human-readable alert text — e.g. 'Parle-G stock is below minimum (2 packs remaining)'|
|**is\_read**|boolean|DEFAULT false|Set true when vendor acknowledges the alert|
|**created\_at**|timestamp|NOT NULL|When alert was generated|
### **12.2  sync\_queue**
The offline sync engine. Every insert, update, or delete that happens while the device is offline is recorded here. When internet is restored, the sync service replays these operations against the cloud database in created\_at order.

|**Field Name**|**Type**|**Constraint**|**Description**|
| :- | :- | :- | :- |
|**id**|uuid|PK|Unique identifier|
|**tenant\_id**|uuid|FK → tenants.id|Which shop's data this operation belongs to|
|**table\_name**|string|NOT NULL|The table that was modified — e.g. 'invoices', 'inventory'|
|**record\_id**|uuid|NOT NULL|The primary key of the modified record|
|**action**|string|NOT NULL|'insert', 'update', 'delete'|
|**version**|integer|NOT NULL|Monotonically increasing per device. Used for conflict detection|
|**device\_id**|string|NOT NULL|Which device made this change — supports multi-device setups|
|**conflict\_strategy**|string|DEFAULT 'server\_wins'|'server\_wins', 'client\_wins', 'manual'. Controls what happens if cloud has a newer version|
|**is\_synced**|boolean|DEFAULT false|Set true after successful cloud sync|
|**error\_message**|text|nullable|Populated if sync attempt failed — preserved for retry and debugging|
|**created\_at**|timestamp|NOT NULL|When the offline operation occurred|
|**synced\_at**|timestamp|nullable|When sync completed successfully|
### **12.3  daily\_metrics**
Pre-aggregated daily snapshot of business performance per tenant. Generated each midnight by a scheduled job. The analytics dashboard reads from this table instead of running expensive SUM queries across invoices and purchases.

|**Field Name**|**Type**|**Constraint**|**Description**|
| :- | :- | :- | :- |
|**id**|uuid|PK|Unique identifier|
|**tenant_id**|uuid|FK → tenants.id|Which shop|
|**branch_id**|uuid|FK → branches.id|Which branch|
|**date**|date|NOT NULL|The business day this snapshot covers|
|**total\_sales**|decimal(10,2)|NOT NULL|Sum of invoices.final\_amount for this date|
|**total\_purchases**|decimal(10,2)|NOT NULL|Sum of purchases.total\_amount for this date|
|**total\_expenses**|decimal(10,2)|NOT NULL|Sum of expenses.amount for this date|
|**total\_profit**|decimal(10,2)|NOT NULL|total\_sales - total\_purchases - total\_expenses|
|**invoices\_count**|integer|NOT NULL|Number of invoices raised on this date|
|**new\_customers\_count**|integer|NOT NULL|Number of new customers added on this date|
|**created\_at**|timestamp|NOT NULL|When this snapshot was generated|
### **12.4  product\_ai\_data**
Stores AI-enriched metadata for each product. Populated and updated by the Python AI service. Powers smart search, voice billing, and product recommendation features.

|**Field Name**|**Type**|**Constraint**|**Description**|
| :- | :- | :- | :- |
|**id**|uuid|PK|Unique identifier|
|**product\_id**|uuid|FK → products.id UNIQUE|One AI profile per product|
|**normalized\_name**|string|NOT NULL|Cleaned, normalised product name for fuzzy matching — e.g. 'amul milk 1 litre'|
|**predicted\_category**|string|nullable|AI-predicted category — e.g. 'Dairy & Eggs'. May differ from manual category|
|**tags**|json|nullable|Array of search tags — e.g. ['milk', 'dairy', 'amul', 'white', '1l']|
|**price\_suggestion**|decimal(10,2)|nullable|AI-suggested selling price based on market data|
|**confidence\_score**|decimal(4,3)|nullable|How confident the AI is in this record — 0.000 to 1.000|
|**last\_used\_at**|timestamp|nullable|Last time this AI profile was accessed — used for cache eviction|
|**updated\_at**|timestamp|NOT NULL|Last time the AI model refreshed this record|


# **13. Indexing Strategy**
Indexes are what make a database fast in production. Without them, every query scans the entire table. The following indexes must be created in your migration files alongside the table definitions.

|*Rule of thumb: every FK column gets an index. Every column that appears in a WHERE clause in a hot query path gets an index. Columns used in ORDER BY date queries get included in composite indexes.*|
| :- |

### **13.1  Mandatory indexes — all tables**

|**Index Name**|**Columns**|**Purpose**|
| :- | :- | :- |
|idx\_users\_tenant|users(tenant\_id)|Filter all staff for a shop|
|idx\_customers\_tenant|customers(tenant\_id)|List all customers for a shop|
|idx\_customers\_phone|customers(phone)|Fast customer lookup by mobile number|
|idx\_suppliers\_tenant|suppliers(tenant\_id)|List all suppliers for a shop|
|idx\_products\_tenant|products(tenant\_id)|List all products for a shop|
|idx\_products\_barcode|products(barcode)|Barcode scanner lookup — must be fast|
|idx\_products\_category|products(tenant\_id, category)|Filter by category within a shop|
|idx\_inventory\_product|inventory(product\_id)|Stock check by product|
|idx\_inv\_batches\_product|inventory\_batches(product\_id)|Batch lookup by product|
|idx\_inv\_batches\_expiry|inventory\_batches(expiry\_date)|Find expiring batches|
|idx\_inv\_logs\_product|inventory\_logs(product\_id, created\_at)|Movement history for a product|
|idx\_offers\_tenant\_active|offers(tenant\_id, is\_active, valid\_from, valid\_until)|Find active offers fast during billing|
|idx\_invoices\_tenant\_date|invoices(tenant\_id, created\_at)|Date-range sales reports|
|idx\_invoices\_customer|invoices(customer\_id)|All invoices for a customer|
|idx\_invoices\_status|invoices(tenant\_id, status)|Filter unpaid or partial invoices|
|idx\_invoice\_items\_invoice|invoice\_items(invoice\_id)|Fetch line items for an invoice|
|idx\_invoice\_items\_product|invoice\_items(product\_id)|Sales history for a product|
|idx\_payments\_tenant\_date|payments(tenant\_id, created\_at)|Payment reports by date|
|idx\_payments\_customer|payments(customer\_id)|All payments from a customer|
|idx\_allocations\_payment|payment\_allocations(payment\_id)|Find allocations for a payment|
|idx\_allocations\_invoice|payment\_allocations(invoice\_id)|Find payments for an invoice|
|idx\_ledger\_customer\_date|customer\_ledger(customer\_id, created\_at)|Chronological ledger for udhaar|
|idx\_ledger\_tenant|customer\_ledger(tenant\_id)|All ledger entries for a shop|
|idx\_snapshots\_customer\_date|ledger\_snapshots(customer\_id, snapshot\_date)|Point-in-time balance lookup|
|idx\_purchases\_tenant|purchases(tenant\_id, created\_at)|Purchase history reports|
|idx\_purchases\_supplier|purchases(supplier\_id)|All purchases from a supplier|
|idx\_purchase\_items\_purchase|purchase\_items(purchase\_id)|Line items for a purchase|
|idx\_expenses\_tenant\_date|expenses(tenant\_id, created\_at)|Expense reports by date|
|idx\_alerts\_tenant\_read|alerts(tenant\_id, is\_read)|Fetch unread alerts quickly|
|idx\_sync\_queue\_tenant\_synced|sync\_queue(tenant\_id, is\_synced)|Find pending sync operations|
|idx\_sync\_queue\_device|sync\_queue(device\_id, version)|Conflict detection by device|
|idx\_daily\_metrics\_tenant\_date|daily\_metrics(tenant\_id, date)|Date-range dashboard queries|
|idx\_plan\_features\_plan|plan\_features(plan\_id, feature\_key)|Fast feature gate enforcement|
|idx\_usage\_tracking|usage\_tracking(tenant\_id, feature\_key, period)|Quota check — hot path|
|idx\_overrides\_tenant|tenant\_overrides(tenant\_id, feature\_key)|Custom override lookup|
|idx\_subscriptions\_tenant|subscriptions(tenant\_id, status)|Active subscription check|


# **14. Key Workflows**
These are the most important database operation sequences in the system. Each workflow must be executed as a single atomic transaction so that a failure mid-way leaves the database in a consistent state.
## **14.1  Creating an Invoice**
1. Check plan quota: query usage\_tracking for max\_invoices\_per\_month. Block if at limit.
1. Lock invoice\_sequences row for this tenant (SELECT FOR UPDATE).
1. Increment current\_number, generate invoice\_number (e.g. INV-0043), release lock.
1. Insert invoices row with computed subtotal, tax\_amount, discount\_amount, final\_amount.
1. Insert invoice\_items rows — snapshot unit\_price and gst\_rate from current product/inventory.
1. Decrement inventory.total\_quantity for each product. If batch tracking, decrement inventory\_batches.quantity (FEFO order).
1. Append inventory\_logs rows (change\_type='sale', quantity\_change=negative).
1. Append customer\_ledger row (entry\_type='invoice', debit=final\_amount). Update running\_balance.
1. Update customers.total\_due += final\_amount.
1. Increment usage\_tracking.used\_count for max\_invoices\_per\_month.
## **14.2  Recording a Payment**
1. Insert payments row. Set status='received', unallocated\_amount=full amount.
1. For each invoice being cleared: insert payment\_allocations row (payment\_id, invoice\_id, amount).
1. Update invoices.amount\_paid and invoices.amount\_due. Set status accordingly.
1. Update payments.unallocated\_amount and status ('fully\_allocated' or 'partially\_allocated').
1. Append customer\_ledger row (entry\_type='payment', credit=amount). Update running\_balance.
1. Update customers.total\_due -= allocated\_amount.
## **14.3  Stock Receiving (Purchase)**
1. Insert purchases row.
1. Insert purchase\_items rows.
1. For each item: if batch tracking, insert inventory\_batches row. Increment inventory.total\_quantity.
1. Append inventory\_logs rows (change\_type='purchase', quantity\_change=positive, reference\_id=purchase.id).


# **15. Full Relationship Summary**

|**From Table**|**Type**|**To Table**|**Meaning**|
| :- | :- | :- | :- |
|tenants|1:N|users|A shop has many staff members|
|tenants|1:1|invoice\_sequences|Each shop has exactly one invoice counter|
|tenants|1:N|customers|A shop manages many customers|
|tenants|1:N|suppliers|A shop works with many suppliers|
|tenants|1:N|products|A shop sells many products|
|tenants|1:N|offers|A shop creates many offers|
|tenants|1:N|invoices|A shop generates many invoices|
|tenants|1:N|payments|A shop receives many payments|
|tenants|1:N|purchases|A shop records many purchases|
|tenants|1:N|expenses|A shop logs many expenses|
|tenants|1:N|subscriptions|A shop has billing history|
|plans|1:N|plan\_features|A plan defines many feature limits|
|products|1:1|inventory|Each product has one summary stock row|
|products|1:N|inventory\_batches|A product can have many stock batches|
|products|1:N|inventory\_logs|Every stock movement is logged per product|
|products|1:1|product\_ai\_data|Each product has one AI enrichment profile|
|customers|1:N|invoices|A customer has many invoices|
|customers|1:N|payments|A customer makes many payments|
|customers|1:N|customer\_ledger|Every debit and credit is a ledger entry|
|customers|1:N|ledger\_snapshots|Daily closing balance snapshots per customer|
|invoices|1:N|invoice\_items|An invoice has many line items|
|invoices|N:M|payments|Via payment\_allocations — many payments can clear many invoices|
|suppliers|1:N|purchases|A supplier fulfils many purchases|
|purchases|1:N|purchase\_items|A purchase document has many line items|
|offers|1:N|invoice\_items|An offer can be applied to many invoice lines|


# **16. Appendix — Enum Values Reference**

### **Status & Type Enums**

|**Table.Column**|**Allowed Values**|**Notes**|
| :- | :- | :- |
|tenants.plan\_status|trial, active, expired, cancelled||
|users.role|admin, cashier|Expandable to manager, viewer|
|invoices.status|paid, partial, unpaid, cancelled|Updated automatically on payment|
|payments.status|received, partially\_allocated, fully\_allocated||
|payments.payment\_mode|cash, upi, card, bank\_transfer, cheque||
|purchases.status|received, partial, pending||
|customer\_ledger.entry\_type|invoice, payment, adjustment||
|inventory\_logs.change\_type|sale, purchase, adjustment, return, waste||
|offers.offer\_type|flat, percentage, bogo, bundle||
|offers.applies\_to|product, category, invoice, customer||
|sync\_queue.action|insert, update, delete||
|sync\_queue.conflict\_strategy|server\_wins, client\_wins, manual|manual = flag for admin review|
|alerts.alert\_type|low\_stock, payment\_due, high\_demand, expiry\_soon, sync\_failed||
|subscriptions.billing\_cycle|monthly, annual||
|plan\_features.feature\_type|quota, toggle|quota uses limit\_value; toggle uses is\_enabled|
|expenses.category|rent, electricity, wages, packaging, transport, other|Extend as needed|



# **17. Premium ERP Extension Schema (Phase 4.5 — Sprints 17–29)**

This section defines the tables added to evolve the system from a billing/POS suite into a premium ERP + CRM platform. All tables follow the global conventions in Section 2 (uuid PKs, `tenant_id` scoping, snake_case, `is_` booleans, `deleted_at` soft delete where applicable, monetary values in `decimal`). Branch-scoped tables also carry `branch_id`.

## **17.1 Table Groups Added**

|**Group**|**Tables**|**Sprint**|
| :- | :- | :- |
|Accounting (GL)|chart\_of\_accounts, journal\_entries, journal\_lines, financial\_years, opening\_balances|18, 20|
|Accounts Payable|supplier\_ledger, supplier\_payments, supplier\_payment\_allocations|19|
|GST & e-Invoicing|einvoice\_logs, eway\_bills (+ tax columns on invoices/invoice\_items)|21|
|Returns|credit\_notes, credit\_note\_items, debit\_notes, debit\_note\_items|22|
|Bank & Cash|bank\_accounts, cash\_registers, bank\_transactions|23|
|Order Management|quotations, quotation\_items, sales\_orders, sales\_order\_items, purchase\_orders, purchase\_order\_items, goods\_receipts, goods\_receipt\_items, delivery\_challans, delivery\_challan\_items|24|
|Advanced Inventory|stock\_transfers, stock\_transfer\_items, price\_lists, price\_list\_items, units, uom\_conversions, product\_serials|25|
|CRM|leads, opportunities, pipeline\_stages, activities, customer\_segments, segment\_members, loyalty\_accounts, loyalty\_transactions|26, 27|
|Communication|campaigns, communication\_logs, message\_templates|27|
|Access & Auth|roles, permissions, role\_permissions, refresh\_tokens, password\_resets|28|
|Platform|audit\_logs, api\_keys, webhooks, webhook\_deliveries, files, notifications|17, 29|

---

## **17.2 Accounting — General Ledger**

### **chart\_of\_accounts**
Per-tenant ledger accounts. Seeded with a default set on registration.

|**Field**|**Type**|**Constraint**|**Description**|
| :- | :- | :- | :- |
|**id**|uuid|PK||
|**tenant\_id**|uuid|FK → tenants.id|Account owner|
|**account\_code**|string|NOT NULL|Numeric/string code — e.g. '1001'|
|**name**|string|NOT NULL|e.g. 'Cash', 'Sales', 'GST Output Payable'|
|**account\_type**|string|NOT NULL|'asset', 'liability', 'income', 'expense', 'equity'|
|**parent\_id**|uuid|FK → chart\_of\_accounts.id (nullable)|For account hierarchy|
|**is\_system**|boolean|DEFAULT false|System accounts cannot be deleted|
|**is\_active**|boolean|DEFAULT true||
|**created\_at**|timestamp|NOT NULL||

### **journal\_entries**
Header for one balanced double-entry transaction.

|**Field**|**Type**|**Constraint**|**Description**|
| :- | :- | :- | :- |
|**id**|uuid|PK||
|**tenant\_id**|uuid|FK → tenants.id||
|**branch\_id**|uuid|FK → branches.id (nullable)||
|**entry\_date**|date|NOT NULL|Accounting date|
|**narration**|text|nullable|Description|
|**reference\_type**|string|nullable|'invoice', 'payment', 'purchase', 'expense', 'credit\_note', 'manual', etc.|
|**reference\_id**|uuid|nullable|Source document id|
|**status**|string|NOT NULL|'posted', 'draft', 'reversed'|
|**created\_by**|uuid|FK → users.id||
|**created\_at**|timestamp|NOT NULL||

### **journal\_lines**
Debit/credit lines. `SUM(debit) = SUM(credit)` per entry is enforced in the service layer.

|**Field**|**Type**|**Constraint**|**Description**|
| :- | :- | :- | :- |
|**id**|uuid|PK||
|**journal\_entry\_id**|uuid|FK → journal\_entries.id||
|**account\_id**|uuid|FK → chart\_of\_accounts.id||
|**debit**|decimal(15,2)|DEFAULT 0||
|**credit**|decimal(15,2)|DEFAULT 0||
|**note**|string|nullable||

### **financial\_years**
|**Field**|**Type**|**Constraint**|**Description**|
| :- | :- | :- | :- |
|**id**|uuid|PK||
|**tenant\_id**|uuid|FK → tenants.id||
|**start\_date**|date|NOT NULL||
|**end\_date**|date|NOT NULL||
|**status**|string|NOT NULL|'open', 'closed'|

### **opening\_balances**
|**Field**|**Type**|**Constraint**|**Description**|
| :- | :- | :- | :- |
|**id**|uuid|PK||
|**tenant\_id**|uuid|FK → tenants.id||
|**financial\_year\_id**|uuid|FK → financial\_years.id||
|**account\_id**|uuid|FK → chart\_of\_accounts.id||
|**debit**|decimal(15,2)|DEFAULT 0||
|**credit**|decimal(15,2)|DEFAULT 0||

---

## **17.3 Accounts Payable**

### **supplier\_ledger**
Mirror of `customer_ledger` for the payable side.

|**Field**|**Type**|**Constraint**|**Description**|
| :- | :- | :- | :- |
|**id**|uuid|PK||
|**tenant\_id**|uuid|FK → tenants.id||
|**supplier\_id**|uuid|FK → suppliers.id||
|**entry\_type**|string|NOT NULL|'purchase', 'payment', 'debit\_note', 'adjustment'|
|**reference\_id**|uuid|NOT NULL|purchase\_id / supplier\_payment\_id|
|**debit**|decimal(15,2)|DEFAULT 0|Reduces payable (we pay)|
|**credit**|decimal(15,2)|DEFAULT 0|Increases payable (we owe)|
|**running\_balance**|decimal(15,2)|NOT NULL|Positive = we owe supplier|
|**created\_at**|timestamp|NOT NULL||

### **supplier\_payments**
|**Field**|**Type**|**Constraint**|**Description**|
| :- | :- | :- | :- |
|**id**|uuid|PK||
|**tenant\_id**|uuid|FK → tenants.id||
|**supplier\_id**|uuid|FK → suppliers.id||
|**amount**|decimal(15,2)|NOT NULL||
|**unallocated\_amount**|decimal(15,2)|DEFAULT 0|Advance to supplier|
|**payment\_mode**|string|NOT NULL|'cash', 'upi', 'bank\_transfer', 'cheque'|
|**bank\_account\_id**|uuid|FK → bank\_accounts.id (nullable)||
|**reference\_note**|string|nullable||
|**created\_at**|timestamp|NOT NULL||
|**deleted\_at**|timestamp|nullable||

### **supplier\_payment\_allocations**
|**Field**|**Type**|**Constraint**|**Description**|
| :- | :- | :- | :- |
|**id**|uuid|PK||
|**supplier\_payment\_id**|uuid|FK → supplier\_payments.id||
|**purchase\_id**|uuid|FK → purchases.id||
|**amount**|decimal(15,2)|NOT NULL||

---

## **17.4 GST & e-Invoicing**

**Column additions** (Sprint 21): `invoices` and `invoice_items` gain `cgst_amount`, `sgst_amount`, `igst_amount` (decimal(15,2)); `invoices` gains `place_of_supply` (string, state code) and `is_interstate` (boolean). The legacy `tax_amount` becomes the sum of the three components. The same split is added to `purchases`/`purchase_items`, `credit_notes`, and `debit_notes`.

### **einvoice\_logs**
|**Field**|**Type**|**Constraint**|**Description**|
| :- | :- | :- | :- |
|**id**|uuid|PK||
|**tenant\_id**|uuid|FK → tenants.id||
|**invoice\_id**|uuid|FK → invoices.id||
|**irn**|string|nullable|Invoice Reference Number from IRP|
|**ack\_no**|string|nullable|Acknowledgement number|
|**ack\_date**|timestamp|nullable||
|**signed\_qr**|text|nullable|Base64 signed QR payload|
|**status**|string|NOT NULL|'pending', 'generated', 'cancelled', 'failed'|
|**error\_message**|text|nullable||
|**created\_at**|timestamp|NOT NULL||

### **eway\_bills**
|**Field**|**Type**|**Constraint**|**Description**|
| :- | :- | :- | :- |
|**id**|uuid|PK||
|**tenant\_id**|uuid|FK → tenants.id||
|**invoice\_id**|uuid|FK → invoices.id||
|**eway\_bill\_no**|string|nullable||
|**valid\_until**|timestamp|nullable||
|**transporter\_name**|string|nullable||
|**vehicle\_no**|string|nullable||
|**status**|string|NOT NULL|'pending', 'generated', 'cancelled', 'expired'|
|**created\_at**|timestamp|NOT NULL||

---

## **17.5 Credit / Debit Notes**

### **credit\_notes** (sales returns / adjustments)
|**Field**|**Type**|**Constraint**|**Description**|
| :- | :- | :- | :- |
|**id**|uuid|PK||
|**tenant\_id**|uuid|FK → tenants.id||
|**branch\_id**|uuid|FK → branches.id||
|**customer\_id**|uuid|FK → customers.id (nullable)||
|**invoice\_id**|uuid|FK → invoices.id (nullable)|Original invoice|
|**note\_number**|string|NOT NULL|Sequenced — e.g. CN-0001|
|**reason**|string|nullable||
|**subtotal**|decimal(15,2)|NOT NULL||
|**cgst\_amount**|decimal(15,2)|DEFAULT 0||
|**sgst\_amount**|decimal(15,2)|DEFAULT 0||
|**igst\_amount**|decimal(15,2)|DEFAULT 0||
|**total\_amount**|decimal(15,2)|NOT NULL||
|**created\_by**|uuid|FK → users.id||
|**created\_at**|timestamp|NOT NULL||
|**deleted\_at**|timestamp|nullable||

### **credit\_note\_items**
|**Field**|**Type**|**Constraint**|**Description**|
| :- | :- | :- | :- |
|**id**|uuid|PK||
|**credit\_note\_id**|uuid|FK → credit\_notes.id||
|**product\_id**|uuid|FK → products.id||
|**quantity**|decimal(15,3)|NOT NULL|Quantity returned|
|**unit\_price**|decimal(15,2)|NOT NULL||
|**gst\_rate**|decimal(5,2)|NOT NULL||
|**total**|decimal(15,2)|NOT NULL||

### **debit\_notes** / **debit\_note\_items** (purchase returns)
Same structure as credit notes but reference `supplier_id` and `purchase_id`; `debit_note_items` reference `purchase_price` instead of `unit_price`.

---

## **17.6 Bank & Cash**

### **bank\_accounts**
|**Field**|**Type**|**Constraint**|**Description**|
| :- | :- | :- | :- |
|**id**|uuid|PK||
|**tenant\_id**|uuid|FK → tenants.id||
|**branch\_id**|uuid|FK → branches.id (nullable)||
|**name**|string|NOT NULL||
|**account\_no**|string|nullable||
|**ifsc**|string|nullable||
|**account\_id**|uuid|FK → chart\_of\_accounts.id|Mapped GL account|
|**opening\_balance**|decimal(15,2)|DEFAULT 0||
|**is\_active**|boolean|DEFAULT true||

### **cash\_registers**
|**Field**|**Type**|**Constraint**|**Description**|
| :- | :- | :- | :- |
|**id**|uuid|PK||
|**tenant\_id**|uuid|FK → tenants.id||
|**branch\_id**|uuid|FK → branches.id||
|**name**|string|NOT NULL||
|**account\_id**|uuid|FK → chart\_of\_accounts.id||
|**current\_balance**|decimal(15,2)|DEFAULT 0||

### **bank\_transactions**
|**Field**|**Type**|**Constraint**|**Description**|
| :- | :- | :- | :- |
|**id**|uuid|PK||
|**tenant\_id**|uuid|FK → tenants.id||
|**bank\_account\_id**|uuid|FK → bank\_accounts.id||
|**txn\_type**|string|NOT NULL|'deposit', 'withdrawal', 'transfer'|
|**amount**|decimal(15,2)|NOT NULL||
|**reference\_type**|string|nullable|'payment', 'expense', 'supplier\_payment'|
|**reference\_id**|uuid|nullable||
|**is\_reconciled**|boolean|DEFAULT false||
|**txn\_date**|date|NOT NULL||
|**created\_at**|timestamp|NOT NULL||

---

## **17.7 Order Management**

All order documents share a common shape: a header (`tenant_id`, `branch_id`, party id, document number, `status`, monetary totals, dates, `created_by`, `deleted_at`) and a child `*_items` table (parent id, `product_id`, `quantity`, price, `total`).

- **quotations / quotation\_items** — `customer_id`; `status` ('draft','sent','accepted','rejected','converted'); `valid_until`; `converted_to` (sales\_order/invoice id).
- **sales\_orders / sales\_order\_items** — `customer_id`; `status` ('confirmed','partial','fulfilled','cancelled'); `quotation_id` (nullable).
- **purchase\_orders / purchase\_order\_items** — `supplier_id`; `status` ('draft','sent','partial','received','closed'); `expected_date`.
- **goods\_receipts / goods\_receipt\_items** — `purchase_order_id`; received quantities; feeds inventory + creates the `purchases` record.
- **delivery\_challans / delivery\_challan\_items** — `customer_id`; `sales_order_id` (nullable); dispatch details.

---

## **17.8 Advanced Inventory**

**Column additions:** `inventory` gains `reorder_level` and `reorder_quantity` (decimal(15,3)).

### **stock\_transfers / stock\_transfer\_items**
|**Field**|**Type**|**Constraint**|**Description**|
| :- | :- | :- | :- |
|**id**|uuid|PK||
|**tenant\_id**|uuid|FK → tenants.id||
|**from\_branch\_id**|uuid|FK → branches.id||
|**to\_branch\_id**|uuid|FK → branches.id||
|**status**|string|NOT NULL|'pending', 'in\_transit', 'received', 'cancelled'|
|**created\_at**|timestamp|NOT NULL||

`stock_transfer_items`: `stock_transfer_id`, `product_id`, `quantity`. Each transfer creates two `inventory_logs` rows (out at source, in at destination).

### **price\_lists / price\_list\_items**
- `price_lists`: `tenant_id`, `name`, `type` ('retail','wholesale','customer'), `customer_id` (nullable), `is_active`.
- `price_list_items`: `price_list_id`, `product_id`, `price`, optional `min_quantity` for slab pricing.

### **units / uom\_conversions**
- `units`: `tenant_id`, `name` ('piece','box','kg'), `symbol`.
- `uom_conversions`: `product_id`, `from_unit_id`, `to_unit_id`, `factor` (e.g. 1 box = 12 pieces).

### **product\_serials**
|**Field**|**Type**|**Constraint**|**Description**|
| :- | :- | :- | :- |
|**id**|uuid|PK||
|**tenant\_id**|uuid|FK → tenants.id||
|**product\_id**|uuid|FK → products.id||
|**serial\_no**|string|NOT NULL|Serial / IMEI|
|**status**|string|NOT NULL|'in\_stock', 'sold', 'returned'|
|**invoice\_id**|uuid|FK → invoices.id (nullable)||

---

## **17.9 CRM**

### **leads**
|**Field**|**Type**|**Constraint**|**Description**|
| :- | :- | :- | :- |
|**id**|uuid|PK||
|**tenant\_id**|uuid|FK → tenants.id||
|**name**|string|NOT NULL||
|**phone**|string|nullable||
|**email**|string|nullable||
|**source**|string|nullable|'walk\_in', 'referral', 'web', 'campaign'|
|**status**|string|NOT NULL|'new', 'contacted', 'qualified', 'lost', 'converted'|
|**owner\_id**|uuid|FK → users.id (nullable)||
|**created\_at**|timestamp|NOT NULL||

### **opportunities**
|**Field**|**Type**|**Constraint**|**Description**|
| :- | :- | :- | :- |
|**id**|uuid|PK||
|**tenant\_id**|uuid|FK → tenants.id||
|**lead\_id**|uuid|FK → leads.id (nullable)||
|**customer\_id**|uuid|FK → customers.id (nullable)||
|**title**|string|NOT NULL||
|**value**|decimal(15,2)|DEFAULT 0||
|**stage\_id**|uuid|FK → pipeline\_stages.id||
|**expected\_close**|date|nullable||
|**status**|string|NOT NULL|'open', 'won', 'lost'|
|**owner\_id**|uuid|FK → users.id (nullable)||

### **pipeline\_stages**
`tenant_id`, `name`, `sort_order`, `win_probability` (decimal).

### **activities**
|**Field**|**Type**|**Constraint**|**Description**|
| :- | :- | :- | :- |
|**id**|uuid|PK||
|**tenant\_id**|uuid|FK → tenants.id||
|**type**|string|NOT NULL|'task', 'call', 'meeting', 'note'|
|**related\_type**|string|NOT NULL|'lead', 'opportunity', 'customer'|
|**related\_id**|uuid|NOT NULL||
|**subject**|string|NOT NULL||
|**due\_at**|timestamp|nullable||
|**assigned\_to**|uuid|FK → users.id (nullable)||
|**is\_done**|boolean|DEFAULT false||

### **customer\_segments / segment\_members**
- `customer_segments`: `tenant_id`, `name`, `rule` (json, nullable — dynamic criteria).
- `segment_members`: `segment_id`, `customer_id`.

### **loyalty\_accounts / loyalty\_transactions**
- `loyalty_accounts`: `tenant_id`, `customer_id` (UNIQUE), `points_balance`.
- `loyalty_transactions`: `loyalty_account_id`, `type` ('earn','redeem','expire'), `points`, `reference_id` (invoice), `created_at`.

---

## **17.10 Communication**

### **message\_templates**
`tenant_id`, `name`, `channel` ('email','sms','whatsapp'), `subject` (nullable), `body` (with placeholders), `is_active`.

### **campaigns**
`tenant_id`, `name`, `channel`, `segment_id` (nullable), `template_id`, `status` ('draft','scheduled','sent'), `scheduled_at`.

### **communication\_logs**
|**Field**|**Type**|**Constraint**|**Description**|
| :- | :- | :- | :- |
|**id**|uuid|PK||
|**tenant\_id**|uuid|FK → tenants.id||
|**channel**|string|NOT NULL|'email', 'sms', 'whatsapp'|
|**recipient**|string|NOT NULL||
|**template\_id**|uuid|FK → message\_templates.id (nullable)||
|**campaign\_id**|uuid|FK → campaigns.id (nullable)||
|**status**|string|NOT NULL|'queued', 'sent', 'delivered', 'failed'|
|**error\_message**|text|nullable||
|**created\_at**|timestamp|NOT NULL||

---

## **17.11 Access Control & Authentication**

### **roles / permissions / role\_permissions**
- `roles`: `tenant_id`, `name`, `is_system`. Replaces the hardcoded admin/cashier model.
- `permissions`: global registry — `key` (e.g. 'invoice:create', 'report:view'), `description`. Not tenant-scoped.
- `role_permissions`: `role_id`, `permission_key`. `users` gains a `role_id` FK (the legacy `role` string is retained for backward compatibility).

### **refresh\_tokens**
`user_id`, `token_hash`, `expires_at`, `revoked_at` (nullable), `device_id`.

### **password\_resets**
`user_id`, `token_hash`, `expires_at`, `used_at` (nullable).

---

## **17.12 Platform**

### **audit\_logs**
Immutable trail of every mutation. Append-only.

|**Field**|**Type**|**Constraint**|**Description**|
| :- | :- | :- | :- |
|**id**|uuid|PK||
|**tenant\_id**|uuid|FK → tenants.id||
|**user\_id**|uuid|FK → users.id (nullable)||
|**action**|string|NOT NULL|'create', 'update', 'delete'|
|**entity\_type**|string|NOT NULL|Table/module name|
|**entity\_id**|uuid|nullable||
|**before**|json|nullable|Prior state|
|**after**|json|nullable|New state|
|**ip\_address**|string|nullable||
|**created\_at**|timestamp|NOT NULL||

### **api\_keys**
`tenant_id`, `name`, `key_hash`, `prefix`, `scopes` (json), `last_used_at`, `revoked_at` (nullable).

### **webhooks / webhook\_deliveries**
- `webhooks`: `tenant_id`, `url`, `events` (json — e.g. ['invoice.created']), `secret`, `is_active`.
- `webhook_deliveries`: `webhook_id`, `event`, `payload` (json), `status` ('pending','success','failed'), `attempts`, `next_retry_at`, `response_code`.

### **files**
`tenant_id`, `entity_type`, `entity_id`, `file_name`, `mime_type`, `size_bytes`, `storage_path`/`url`, `uploaded_by`, `created_at`.

### **notifications**
In-app notifications distinct from the operational `alerts` table: `tenant_id`, `user_id`, `type`, `title`, `body`, `is_read`, `created_at`.

---

## **17.13 Extension Indexing Notes**

Following the Section 13 rule (index every FK and every hot-path WHERE column), the extension adds, at minimum:

- `idx_coa_tenant` → chart\_of\_accounts(tenant\_id, account\_type)
- `idx_journal_lines_account` → journal\_lines(account\_id)
- `idx_journal_entries_ref` → journal\_entries(tenant\_id, reference\_type, reference\_id)
- `idx_supplier_ledger_supplier` → supplier\_ledger(supplier\_id, created\_at)
- `idx_einvoice_invoice` → einvoice\_logs(invoice\_id)
- `idx_credit_notes_invoice` → credit\_notes(invoice\_id)
- `idx_bank_txn_account` → bank\_transactions(bank\_account\_id, is\_reconciled)
- `idx_quotations_tenant` → quotations(tenant\_id, status)
- `idx_sales_orders_tenant` → sales\_orders(tenant\_id, status)
- `idx_purchase_orders_supplier` → purchase\_orders(supplier\_id, status)
- `idx_stock_transfers_branches` → stock\_transfers(from\_branch\_id, to\_branch\_id)
- `idx_product_serials_serial` → product\_serials(tenant\_id, serial\_no)
- `idx_leads_tenant_status` → leads(tenant\_id, status)
- `idx_opportunities_stage` → opportunities(tenant\_id, stage\_id)
- `idx_activities_related` → activities(related\_type, related\_id)
- `idx_comm_logs_tenant` → communication\_logs(tenant\_id, created\_at)
- `idx_role_permissions_role` → role\_permissions(role\_id)
- `idx_refresh_tokens_user` → refresh\_tokens(user\_id)
- `idx_audit_logs_entity` → audit\_logs(tenant\_id, entity\_type, entity\_id)
- `idx_webhook_deliveries_status` → webhook\_deliveries(status, next\_retry\_at)

---

# **18. Offline Resilience Schema (Phase 4.6 — Sprints 30–32)**

This section covers schema changes for draft "chit" invoices, soft stock reservations, bulk onboarding, and tamper-resistant offline licensing. These are deltas to existing tables plus a few new local-only keys.

## **18.1 Column Additions to Existing Tables**

### **invoices**
|**Change**|**Detail**|
| :- | :- |
|`invoice_number` → nullable|Drafts must not consume the formal GST sequence. Number is assigned only on finalize.|
|`status` → add `'draft'`|New lifecycle: 'draft', 'paid', 'partial', 'unpaid', 'cancelled'.|
|**token\_number** (new)|string, nullable. Daily physical chit token (e.g. 'T-405'); resets daily. Not unique across days.|

### **invoice\_items**
|**Change**|**Detail**|
| :- | :- |
|**is\_reserved** (new)|boolean, DEFAULT false. Marks a line as a soft hold (draft) rather than a confirmed sale.|

### **inventory\_logs**
|**Change**|**Detail**|
| :- | :- |
|`change_type` → add `'reserved'`|New full set: 'sale', 'purchase', 'adjustment', 'return', 'waste', 'reserved'. A draft writes a `reserved` log; finalize rewrites it to `sale`; cancel reverses it.|

### **users**
|**Change**|**Detail**|
| :- | :- |
|**offline\_pin\_hash** (new)|string, nullable. bcrypt hash of the cashier's 4-digit Offline PIN, set while online, used for offline auth.|

## **18.2 Local System Settings (SQLite)**

The `settings` key-value table additionally holds device-local, system-managed keys (not shown in the UI). These exist only in the local SQLite DB and are not synced to the cloud.

|**Key**|**Stored Value**|**Purpose**|
| :- | :- | :- |
|**offline\_license**|signed JWT|Offline entitlement: signature, `valid_until`, `max_offline_invoices`. Verified with a bundled public key.|
|**last\_timestamp**|epoch ms|Monotonic clock watermark. Each write advances it; a smaller `Date.now()` indicates clock tampering and triggers `SECURITY_LOCKDOWN`.|

## **18.3 New Enum Value Reference**

|**Table.Column**|**Added Value(s)**|
| :- | :- |
|invoices.status|draft|
|invoice\_logs.change\_type *(inventory\_logs)*|reserved|

## **18.4 Finalize Workflow (Draft → Invoice)**

1. Run the offline license-security guard (monotonic clock, signature, expiry, volume quota).
1. Lock `invoice_sequences` (SELECT FOR UPDATE) → assign formal `invoice_number`.
1. Set `invoices.status` from 'draft' to its paid/partial/unpaid state; clear `token_number` linkage as needed.
1. Rewrite each `inventory_logs` row for this invoice from `change_type='reserved'` to `'sale'`; set `invoice_items.is_reserved=false`.
1. Append `customer_ledger` (debit = final\_amount) and update `customers.total_due`.
1. Increment `usage_tracking.used_count` for `max_invoices_per_month`.

---

*End of Document  —  AI-Powered Offline ERP Billing System*
AI-Powered Offline ERP Billing System
