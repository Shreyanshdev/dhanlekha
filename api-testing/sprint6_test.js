const axios = require('axios');

const BASE_URL = 'http://localhost:3001/api/v1';
let passed = 0;
let failed = 0;

function assert(condition, testName, details = '') {
  if (condition) {
    passed++;
    console.log(`  ✅ ${testName}`);
  } else {
    failed++;
    console.log(`  ❌ FAIL: ${testName} ${details}`);
  }
}

async function setup() {
  const reg = await axios.post(`${BASE_URL}/auth/register`, {
    tenantName: 'Sprint6 Test Store',
    tenantEmail: `s6_${Date.now()}@test.com`,
    phone: '8888800000',
    planId: 'growth',
    userName: 'S6 Admin',
    password: 'password123'
  });
  const login = await axios.post(`${BASE_URL}/auth/login`, {
    email: reg.data.data.user.email,
    password: 'password123'
  });
  return {
    headers: { Authorization: `Bearer ${login.data.data.token}` },
    branchId: login.data.data.user.branchId,
  };
}

async function runTests() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('  📡 SPRINT 6 — BARCODE & MANUAL BILLING TEST');
  console.log('═══════════════════════════════════════════════════════\n');

  const { headers } = await setup();

  // Create test product: ₹250.00, GST 12%, stock 50
  const prodRes = await axios.post(`${BASE_URL}/products`, {
    name: 'Barcode Test Widget',
    barcode: `SCAN-${Date.now()}`,
    gst_rate: 12,
    base_unit: 'pcs',
    initial_quantity: 50,
    selling_price: 25000,
    purchase_price: 18000,
  }, { headers });
  const product = prodRes.data.data;
  const barcode = product.barcode;
  const productId = product.id;

  console.log(`  Product: ${product.name} (₹250, GST 12%, Stock 50)`);
  console.log(`  Barcode: ${barcode}\n`);

  // ──────────────────────────────────────────────────────────
  // TEST 1: Barcode Lookup — Returns Product + Inventory
  // ──────────────────────────────────────────────────────────
  console.log('── TEST 1: Barcode Lookup (GET /products/barcode/:code) ──');
  {
    const res = await axios.get(`${BASE_URL}/products/barcode/${barcode}`, { headers });
    const data = res.data.data;

    assert(data.id === productId, 'Returns correct product ID');
    assert(data.name === 'Barcode Test Widget', `Name = ${data.name}`);
    assert(data.gst_rate === 12, `GST rate = ${data.gst_rate}`);
    assert(data.selling_price === 25000, `Selling price = ₹250.00 (got ${data.selling_price})`);
    assert(data.total_quantity === 50, `Stock = 50 (got ${data.total_quantity})`);
    assert(data.in_stock === true, `in_stock = true`);
    assert(data.barcode === barcode, 'Barcode matches');
  }

  // ──────────────────────────────────────────────────────────
  // TEST 2: Barcode Scan Billing — No price/tax sent
  // ──────────────────────────────────────────────────────────
  console.log('\n── TEST 2: Barcode Scan Billing (auto-lookup) ──');
  {
    // Frontend sends ONLY product_id + quantity (like a barcode scanner)
    const inv = await axios.post(`${BASE_URL}/invoices`, {
      items: [
        { product_id: productId, quantity: 3 }
        // NO unit_price, NO gst_rate → backend auto-fetches from DB
      ],
      amount_paid: 0,
    }, { headers });
    const invoice = inv.data.data;

    // Expected: 3 × ₹250 = ₹750, GST 12% = ₹90, Total = ₹840
    assert(invoice.subtotal === 75000, `Auto subtotal = 750.00 (got ${invoice.subtotal})`);
    assert(invoice.tax_amount === 9000, `Auto tax = 90.00 (got ${invoice.tax_amount})`);
    assert(invoice.final_amount === 84000, `Auto total = 840.00 (got ${invoice.final_amount})`);
    assert(invoice.status === 'unpaid', `Status = unpaid`);
  }

  // ──────────────────────────────────────────────────────────
  // TEST 3: Manual Billing — Override price and tax
  // ──────────────────────────────────────────────────────────
  console.log('\n── TEST 3: Manual Billing (price override) ──');
  {
    // Shopkeeper manually sets a different price (₹300) and tax (5%)
    const inv = await axios.post(`${BASE_URL}/invoices`, {
      items: [
        {
          product_id: productId,
          quantity: 2,
          unit_price: 30000,  // Override: ₹300 instead of ₹250
          gst_rate: 5,        // Override: 5% instead of 12%
        }
      ],
      amount_paid: 63000,  // Fully paid
    }, { headers });
    const invoice = inv.data.data;

    // Expected: 2 × ₹300 = ₹600, GST 5% = ₹30, Total = ₹630
    assert(invoice.subtotal === 60000, `Override subtotal = 600.00 (got ${invoice.subtotal})`);
    assert(invoice.tax_amount === 3000, `Override tax = 30.00 (got ${invoice.tax_amount})`);
    assert(invoice.final_amount === 63000, `Override total = 630.00 (got ${invoice.final_amount})`);
    assert(invoice.status === 'paid', `Status = paid`);
  }

  // ──────────────────────────────────────────────────────────
  // TEST 4: Mixed Mode — Some items scanned, some manual
  // ──────────────────────────────────────────────────────────
  console.log('\n── TEST 4: Mixed Mode (scan + manual in same invoice) ──');
  {
    // Create a second product
    const p2Res = await axios.post(`${BASE_URL}/products`, {
      name: 'Manual Only Item',
      barcode: `MAN-${Date.now()}`,
      gst_rate: 18,
      base_unit: 'pcs',
      initial_quantity: 30,
      selling_price: 10000, // ₹100
      purchase_price: 7000,
    }, { headers });
    const p2Id = p2Res.data.data.id;

    const inv = await axios.post(`${BASE_URL}/invoices`, {
      items: [
        // Item 1: Scanned (auto-lookup) — uses DB price ₹250, GST 12%
        { product_id: productId, quantity: 1 },
        // Item 2: Manual override — ₹150, GST 0%
        { product_id: p2Id, quantity: 2, unit_price: 15000, gst_rate: 0 },
      ],
      amount_paid: 0,
    }, { headers });
    const invoice = inv.data.data;

    // Item 1: 1 × ₹250 = ₹250, GST 12% = ₹30, total = ₹280
    // Item 2: 2 × ₹150 = ₹300, GST 0% = ₹0, total = ₹300
    // Grand: subtotal=550, tax=30, final=580
    assert(invoice.subtotal === 55000, `Mixed subtotal = 550.00 (got ${invoice.subtotal})`);
    assert(invoice.tax_amount === 3000, `Mixed tax = 30.00 (got ${invoice.tax_amount})`);
    assert(invoice.final_amount === 58000, `Mixed total = 580.00 (got ${invoice.final_amount})`);
  }

  // ──────────────────────────────────────────────────────────
  // TEST 5: Stock Validation — Insufficient stock blocked
  // ──────────────────────────────────────────────────────────
  console.log('\n── TEST 5: Insufficient Stock Validation ──');
  {
    try {
      await axios.post(`${BASE_URL}/invoices`, {
        items: [{ product_id: productId, quantity: 9999 }],
        amount_paid: 0,
      }, { headers });
      assert(false, 'Should block insufficient stock');
    } catch (err) {
      assert(err.response.status === 400, `Insufficient stock → 400 (got ${err.response.status})`);
      assert(err.response.data.error.message.includes('Insufficient stock'),
        `Error mentions "Insufficient stock"`);
    }
  }

  // ──────────────────────────────────────────────────────────
  // TEST 6: Invalid Barcode — 404
  // ──────────────────────────────────────────────────────────
  console.log('\n── TEST 6: Invalid Barcode Lookup ──');
  {
    try {
      await axios.get(`${BASE_URL}/products/barcode/FAKE-999`, { headers });
      assert(false, 'Should 404 on fake barcode');
    } catch (err) {
      assert(err.response.status === 404, `Fake barcode → 404 (got ${err.response.status})`);
    }
  }

  // ──────────────────────────────────────────────────────────
  // TEST 7: Verify Stock Was Decremented
  // ──────────────────────────────────────────────────────────
  console.log('\n── TEST 7: Stock Decrement Verification ──');
  {
    const res = await axios.get(`${BASE_URL}/products/barcode/${barcode}`, { headers });
    // Started with 50, sold 3 (test 2) + 2 (test 3) + 1 (test 4) = 6 sold
    assert(res.data.data.total_quantity === 44, `Stock = 44 after selling 6 (got ${res.data.data.total_quantity})`);
  }

  // ──────────────────────────────────────────────────────────
  // RESULTS
  // ──────────────────────────────────────────────────────────
  console.log('\n═══════════════════════════════════════════════════════');
  console.log(`  RESULTS: ${passed} passed, ${failed} failed out of ${passed + failed} assertions`);
  console.log('═══════════════════════════════════════════════════════');

  if (failed > 0) process.exit(1);
}

runTests().catch(err => {
  console.error('\n💥 FATAL ERROR:', err.response?.data || err.message);
  process.exit(1);
});
