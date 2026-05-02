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
    tenantName: 'Stress Test Corp',
    tenantEmail: `stress_${Date.now()}@test.com`,
    phone: '9999900000',
    planId: 'growth',
    userName: 'Stress Admin',
    password: 'password123'
  });
  const login = await axios.post(`${BASE_URL}/auth/login`, {
    email: reg.data.data.user.email,
    password: 'password123'
  });
  return {
    token: login.data.data.token,
    headers: { Authorization: `Bearer ${login.data.data.token}` },
    branchId: login.data.data.user.branchId,
  };
}

async function createProduct(headers, name, qty, sellPrice, gstRate) {
  const res = await axios.post(`${BASE_URL}/products`, {
    name,
    barcode: `BC-${Date.now()}-${Math.random().toString(36).substring(7)}`,
    gst_rate: gstRate,
    base_unit: 'pcs',
    initial_quantity: qty,
    selling_price: sellPrice,
    purchase_price: Math.floor(sellPrice * 0.7),
  }, { headers });
  return res.data.data.id;
}

async function createCustomer(headers, name, creditLimit) {
  const res = await axios.post(`${BASE_URL}/customers`, {
    name,
    phone: `${Date.now()}`.slice(-10),
    credit_limit: creditLimit,
  }, { headers });
  return res.data.data.id;
}

async function getCustomer(headers, id) {
  const res = await axios.get(`${BASE_URL}/customers/${id}`, { headers });
  return res.data.data;
}

async function runTests() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('  🔥 CRITICAL BILLING ENGINE — EDGE CASE STRESS TEST');
  console.log('═══════════════════════════════════════════════════════\n');

  const { headers } = await setup();

  // ──────────────────────────────────────────────────────────
  // TEST 1: Full Invoice Lifecycle — Create, Verify, Cancel, Verify
  // ──────────────────────────────────────────────────────────
  console.log('── TEST 1: Full Invoice Lifecycle ──');
  {
    const productId = await createProduct(headers, 'Lifecycle Item', 100, 50000, 18);
    const customerId = await createCustomer(headers, 'Lifecycle Customer', 10000000);

    // Create invoice: 3 items × ₹500 = ₹1500, 18% GST = ₹270, Total = ₹1770
    // Pay ₹770 at billing → Due ₹1000
    const inv = await axios.post(`${BASE_URL}/invoices`, {
      customer_id: customerId,
      items: [{ product_id: productId, quantity: 3, unit_price: 50000, gst_rate: 18 }],
      amount_paid: 77000,
    }, { headers });
    const invoice = inv.data.data;

    assert(invoice.invoice_number === 'INV-0001', 'First invoice gets INV-0001');
    assert(invoice.subtotal === 150000, `Subtotal = 1500.00 (got ${invoice.subtotal})`);
    assert(invoice.tax_amount === 27000, `Tax = 270.00 (got ${invoice.tax_amount})`);
    assert(invoice.final_amount === 177000, `Final = 1770.00 (got ${invoice.final_amount})`);
    assert(invoice.amount_due === 100000, `Due = 1000.00 (got ${invoice.amount_due})`);
    assert(invoice.status === 'partial', `Status = partial (got ${invoice.status})`);

    // Verify customer balance = amount_due (not final_amount!)
    const cust1 = await getCustomer(headers, customerId);
    assert(Number(cust1.total_due) === 100000, `Customer total_due = 1000.00 after partial (got ${cust1.total_due})`);

    // Cancel the invoice
    await axios.delete(`${BASE_URL}/invoices/${invoice.id}`, { headers });

    // Verify customer balance is back to 0
    const cust2 = await getCustomer(headers, customerId);
    assert(Number(cust2.total_due) === 0, `Customer total_due = 0 after cancel (got ${cust2.total_due})`);
  }

  // ──────────────────────────────────────────────────────────
  // TEST 2: Fully Paid Invoice — Status & Ledger
  // ──────────────────────────────────────────────────────────
  console.log('\n── TEST 2: Fully Paid Invoice ──');
  {
    const productId = await createProduct(headers, 'Paid Item', 50, 10000, 5);
    const customerId = await createCustomer(headers, 'Full Pay Customer', 10000000);

    // 1 × ₹100, 5% GST = ₹5, Total = ₹105, Pay ₹105
    const inv = await axios.post(`${BASE_URL}/invoices`, {
      customer_id: customerId,
      items: [{ product_id: productId, quantity: 1, unit_price: 10000, gst_rate: 5 }],
      amount_paid: 10500,
    }, { headers });

    assert(inv.data.data.status === 'paid', `Status = paid (got ${inv.data.data.status})`);
    assert(inv.data.data.amount_due === 0, `Due = 0 (got ${inv.data.data.amount_due})`);

    const cust = await getCustomer(headers, customerId);
    assert(Number(cust.total_due) === 0, `Fully paid → total_due = 0 (got ${cust.total_due})`);
  }

  // ──────────────────────────────────────────────────────────
  // TEST 3: Zero Payment (Full Credit/Udhaar)
  // ──────────────────────────────────────────────────────────
  console.log('\n── TEST 3: Full Udhaar (Zero Payment) ──');
  {
    const productId = await createProduct(headers, 'Udhaar Item', 50, 20000, 12);
    const customerId = await createCustomer(headers, 'Udhaar Customer', 10000000);

    // 2 × ₹200, 12% GST = ₹48, Total = ₹448, Pay ₹0
    const inv = await axios.post(`${BASE_URL}/invoices`, {
      customer_id: customerId,
      items: [{ product_id: productId, quantity: 2, unit_price: 20000, gst_rate: 12 }],
      amount_paid: 0,
    }, { headers });

    assert(inv.data.data.status === 'unpaid', `Status = unpaid (got ${inv.data.data.status})`);
    assert(inv.data.data.amount_due === 44800, `Due = 448.00 (got ${inv.data.data.amount_due})`);

    const cust = await getCustomer(headers, customerId);
    assert(Number(cust.total_due) === 44800, `Udhaar → total_due = 448.00 (got ${cust.total_due})`);
  }

  // ──────────────────────────────────────────────────────────
  // TEST 4: Anonymous Invoice (No Customer)
  // ──────────────────────────────────────────────────────────
  console.log('\n── TEST 4: Anonymous Invoice (Walk-in Cash Sale) ──');
  {
    const productId = await createProduct(headers, 'Cash Item', 50, 5000, 0);

    const inv = await axios.post(`${BASE_URL}/invoices`, {
      items: [{ product_id: productId, quantity: 5, unit_price: 5000, gst_rate: 0 }],
      amount_paid: 25000,
    }, { headers });

    assert(inv.data.data.customer_id === null, 'Anonymous sale has null customer');
    assert(inv.data.data.status === 'paid', `Cash sale status = paid (got ${inv.data.data.status})`);
    assert(inv.data.data.tax_amount === 0, `Zero GST = 0 tax (got ${inv.data.data.tax_amount})`);
  }

  // ──────────────────────────────────────────────────────────
  // TEST 5: Credit Limit — Exact Boundary
  // ──────────────────────────────────────────────────────────
  console.log('\n── TEST 5: Credit Limit Boundary ──');
  {
    const productId = await createProduct(headers, 'Credit Test Item', 100, 10000, 0);
    // Credit limit = ₹100.00 (10000 paise)
    const customerId = await createCustomer(headers, 'Tight Credit', 10000);

    // Invoice for exactly ₹100 (at limit) — should PASS
    const inv1 = await axios.post(`${BASE_URL}/invoices`, {
      customer_id: customerId,
      items: [{ product_id: productId, quantity: 1, unit_price: 10000, gst_rate: 0 }],
      amount_paid: 0,
    }, { headers });
    assert(inv1.data.data.id !== undefined, 'Invoice at exact credit limit succeeds');

    // Second invoice for ₹100 — should FAIL (already ₹100 owed)
    try {
      await axios.post(`${BASE_URL}/invoices`, {
        customer_id: customerId,
        items: [{ product_id: productId, quantity: 1, unit_price: 10000, gst_rate: 0 }],
        amount_paid: 0,
      }, { headers });
      assert(false, 'Second credit invoice should be blocked');
    } catch (err) {
      assert(err.response.status === 400, `Credit exceeded → 400 (got ${err.response.status})`);
      assert(err.response.data.error.message.includes('Credit limit exceeded'),
        'Error message mentions credit limit');
    }

    // Third invoice with full payment — should PASS (no credit used)
    const inv3 = await axios.post(`${BASE_URL}/invoices`, {
      customer_id: customerId,
      items: [{ product_id: productId, quantity: 1, unit_price: 10000, gst_rate: 0 }],
      amount_paid: 10000, // Fully paid
    }, { headers });
    assert(inv3.data.data.id !== undefined, 'Fully paid invoice passes despite credit limit reached');
  }

  // ──────────────────────────────────────────────────────────
  // TEST 6: Double Cancellation
  // ──────────────────────────────────────────────────────────
  console.log('\n── TEST 6: Double Cancellation ──');
  {
    const productId = await createProduct(headers, 'Double Cancel Item', 50, 5000, 0);

    const inv = await axios.post(`${BASE_URL}/invoices`, {
      items: [{ product_id: productId, quantity: 1, unit_price: 5000, gst_rate: 0 }],
      amount_paid: 5000,
    }, { headers });

    await axios.delete(`${BASE_URL}/invoices/${inv.data.data.id}`, { headers });

    try {
      await axios.delete(`${BASE_URL}/invoices/${inv.data.data.id}`, { headers });
      assert(false, 'Double cancel should be blocked');
    } catch (err) {
      assert(err.response.status === 400, `Double cancel → 400 (got ${err.response.status})`);
    }
  }

  // ──────────────────────────────────────────────────────────
  // TEST 7: Multi-Item Invoice with Mixed GST & Discounts
  // ──────────────────────────────────────────────────────────
  console.log('\n── TEST 7: Complex Multi-Item Invoice ──');
  {
    const p1 = await createProduct(headers, 'Item A (GST 18%)', 100, 100000, 18);
    const p2 = await createProduct(headers, 'Item B (GST 5%)', 100, 50000, 5);
    const p3 = await createProduct(headers, 'Item C (GST 0%)', 100, 25000, 0);

    // Item A: 2 × ₹1000 = ₹2000, discount ₹100 → taxable ₹1900, tax 18% = ₹342, total = ₹2242
    // Item B: 3 × ₹500 = ₹1500, discount ₹50 → taxable ₹1450, tax 5% = ₹72.50, total = ₹1522.50
    // Item C: 1 × ₹250 = ₹250, discount ₹0 → taxable ₹250, tax 0% = ₹0, total = ₹250
    // Grand: subtotal=3750, discount=150, tax=414.50, final=4014.50
    const inv = await axios.post(`${BASE_URL}/invoices`, {
      items: [
        { product_id: p1, quantity: 2, unit_price: 100000, gst_rate: 18, discount_amount: 10000 },
        { product_id: p2, quantity: 3, unit_price: 50000, gst_rate: 5, discount_amount: 5000 },
        { product_id: p3, quantity: 1, unit_price: 25000, gst_rate: 0, discount_amount: 0 },
      ],
      amount_paid: 0,
    }, { headers });
    const invoice = inv.data.data;

    assert(invoice.subtotal === 375000, `Multi-item subtotal = 3750.00 (got ${invoice.subtotal})`);
    assert(invoice.discount_amount === 15000, `Total discount = 150.00 (got ${invoice.discount_amount})`);
    assert(invoice.tax_amount === 41450, `Mixed GST = 414.50 (got ${invoice.tax_amount})`);
    assert(invoice.final_amount === 401450, `Final = 4014.50 (got ${invoice.final_amount})`);
  }

  // ──────────────────────────────────────────────────────────
  // TEST 8: Concurrent Invoice Numbers (Race Condition)
  // ──────────────────────────────────────────────────────────
  console.log('\n── TEST 8: Concurrent Invoice Numbers (10 parallel) ──');
  {
    const productId = await createProduct(headers, 'Race Item', 1000, 100, 0);

    const promises = Array(10).fill(null).map(() =>
      axios.post(`${BASE_URL}/invoices`, {
        items: [{ product_id: productId, quantity: 1, unit_price: 100, gst_rate: 0 }],
        amount_paid: 100,
      }, { headers })
    );

    const results = await Promise.allSettled(promises);
    const numbers = results
      .filter(r => r.status === 'fulfilled')
      .map(r => r.value.data.data.invoice_number);

    const unique = new Set(numbers);
    assert(unique.size === numbers.length, `All ${numbers.length} numbers unique (${[...unique].join(', ')})`);
  }

  // ──────────────────────────────────────────────────────────
  // TEST 9: Validation Rejections
  // ──────────────────────────────────────────────────────────
  console.log('\n── TEST 9: Validation Rejections ──');
  {
    // Empty items array
    try {
      await axios.post(`${BASE_URL}/invoices`, { items: [], amount_paid: 0 }, { headers });
      assert(false, 'Empty items should fail');
    } catch (err) {
      assert(err.response.status === 400, 'Empty items → 400');
    }

    // Negative quantity
    try {
      await axios.post(`${BASE_URL}/invoices`, {
        items: [{ product_id: '00000000-0000-0000-0000-000000000001', quantity: -5, unit_price: 100, gst_rate: 0 }],
        amount_paid: 0,
      }, { headers });
      assert(false, 'Negative quantity should fail');
    } catch (err) {
      assert(err.response.status === 400, 'Negative quantity → 400');
    }

    // Invalid UUID
    try {
      await axios.post(`${BASE_URL}/invoices`, {
        items: [{ product_id: 'not-a-uuid', quantity: 1, unit_price: 100, gst_rate: 0 }],
        amount_paid: 0,
      }, { headers });
      assert(false, 'Invalid UUID should fail');
    } catch (err) {
      assert(err.response.status === 400, 'Invalid UUID → 400');
    }

    // Negative amount_paid
    try {
      await axios.post(`${BASE_URL}/invoices`, {
        items: [{ product_id: '00000000-0000-0000-0000-000000000001', quantity: 1, unit_price: 100, gst_rate: 0 }],
        amount_paid: -500,
      }, { headers });
      assert(false, 'Negative payment should fail');
    } catch (err) {
      assert(err.response.status === 400, 'Negative payment → 400');
    }

    // GST rate > 100
    try {
      await axios.post(`${BASE_URL}/invoices`, {
        items: [{ product_id: '00000000-0000-0000-0000-000000000001', quantity: 1, unit_price: 100, gst_rate: 150 }],
        amount_paid: 0,
      }, { headers });
      assert(false, 'GST > 100 should fail');
    } catch (err) {
      assert(err.response.status === 400, 'GST > 100 → 400');
    }
  }

  // ──────────────────────────────────────────────────────────
  // TEST 10: Non-Existent Product
  // ──────────────────────────────────────────────────────────
  console.log('\n── TEST 10: Non-Existent Product in Invoice ──');
  {
    try {
      await axios.post(`${BASE_URL}/invoices`, {
        items: [{ product_id: '00000000-0000-0000-0000-000000000099', quantity: 1, unit_price: 100, gst_rate: 0 }],
        amount_paid: 100,
      }, { headers });
      assert(false, 'Fake product should fail');
    } catch (err) {
      assert(err.response.status >= 400, `Non-existent product blocked (${err.response.status})`);
    }
  }

  // ──────────────────────────────────────────────────────────
  // TEST 11: Discount Larger Than Item Price
  // ──────────────────────────────────────────────────────────
  console.log('\n── TEST 11: Discount > Item Price ──');
  {
    const productId = await createProduct(headers, 'Discount Edge Item', 50, 10000, 18);

    // Price ₹100, discount ₹200 → taxable = -₹100 → negative tax
    // This should either be blocked or result in a negative total
    const inv = await axios.post(`${BASE_URL}/invoices`, {
      items: [{ product_id: productId, quantity: 1, unit_price: 10000, gst_rate: 18, discount_amount: 20000 }],
      amount_paid: 0,
    }, { headers });

    // The system currently allows this (negative totals)
    // Flag it as a known behavior
    const finalAmt = inv.data.data.final_amount;
    console.log(`  ⚠️  INFO: Discount > Price results in final_amount = ${finalAmt} (negative allowed currently)`);
    assert(true, 'System handles over-discount without crash');
  }

  // ──────────────────────────────────────────────────────────
  // TEST 12: Multiple Invoices Accumulate Balance Correctly
  // ──────────────────────────────────────────────────────────
  console.log('\n── TEST 12: Cumulative Balance Across Multiple Invoices ──');
  {
    const productId = await createProduct(headers, 'Balance Test Item', 100, 10000, 0);
    const customerId = await createCustomer(headers, 'Balance Tracker', 10000000);

    // Invoice 1: ₹100, pay ₹0 → due ₹100
    await axios.post(`${BASE_URL}/invoices`, {
      customer_id: customerId,
      items: [{ product_id: productId, quantity: 1, unit_price: 10000, gst_rate: 0 }],
      amount_paid: 0,
    }, { headers });

    let cust = await getCustomer(headers, customerId);
    assert(Number(cust.total_due) === 10000, `After inv 1: due = 100.00 (got ${cust.total_due})`);

    // Invoice 2: ₹200, pay ₹50 → due ₹150, cumulative = ₹250
    await axios.post(`${BASE_URL}/invoices`, {
      customer_id: customerId,
      items: [{ product_id: productId, quantity: 2, unit_price: 10000, gst_rate: 0 }],
      amount_paid: 5000,
    }, { headers });

    cust = await getCustomer(headers, customerId);
    assert(Number(cust.total_due) === 25000, `After inv 2: due = 250.00 (got ${cust.total_due})`);

    // Invoice 3: ₹300, pay ₹300 → due ₹0, cumulative still ₹250
    await axios.post(`${BASE_URL}/invoices`, {
      customer_id: customerId,
      items: [{ product_id: productId, quantity: 3, unit_price: 10000, gst_rate: 0 }],
      amount_paid: 30000,
    }, { headers });

    cust = await getCustomer(headers, customerId);
    assert(Number(cust.total_due) === 25000, `After fully-paid inv 3: due still 250.00 (got ${cust.total_due})`);
  }

  // ──────────────────────────────────────────────────────────
  // TEST 13: Fetch Invoice with Items
  // ──────────────────────────────────────────────────────────
  console.log('\n── TEST 13: GET Invoice Details ──');
  {
    const productId = await createProduct(headers, 'Detail Item', 50, 8000, 12);

    const inv = await axios.post(`${BASE_URL}/invoices`, {
      items: [{ product_id: productId, quantity: 4, unit_price: 8000, gst_rate: 12 }],
      amount_paid: 0,
    }, { headers });

    const detail = await axios.get(`${BASE_URL}/invoices/${inv.data.data.id}`, { headers });
    assert(detail.data.data.items !== undefined, 'Invoice detail includes items array');
    assert(detail.data.data.items.length === 1, `Items count = 1 (got ${detail.data.data.items.length})`);
    assert(detail.data.data.items[0].quantity === 4, `Item quantity = 4`);
  }

  // ──────────────────────────────────────────────────────────
  // TEST 14: List Invoices Pagination
  // ──────────────────────────────────────────────────────────
  console.log('\n── TEST 14: List & Pagination ──');
  {
    const listRes = await axios.get(`${BASE_URL}/invoices?page=1&limit=5`, { headers });
    assert(listRes.data.pagination !== undefined, 'Pagination metadata present');
    assert(listRes.data.pagination.page === 1, 'Page = 1');
    assert(listRes.data.pagination.limit === 5, 'Limit = 5');
    assert(listRes.data.data.length <= 5, `Results <= limit (got ${listRes.data.data.length})`);
    assert(listRes.data.pagination.total > 0, `Total > 0 (got ${listRes.data.pagination.total})`);
  }

  // ──────────────────────────────────────────────────────────
  // RESULTS
  // ──────────────────────────────────────────────────────────
  console.log('\n═══════════════════════════════════════════════════════');
  console.log(`  RESULTS: ${passed} passed, ${failed} failed out of ${passed + failed} assertions`);
  console.log('═══════════════════════════════════════════════════════');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('\n💥 FATAL ERROR:', err.response?.data || err.message);
  process.exit(1);
});
