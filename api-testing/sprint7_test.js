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
    console.log(`  ❌ FAIL: ${testName} ${details ? `— ${details}` : ''}`);
  }
}

async function setup() {
  const reg = await axios.post(`${BASE_URL}/auth/register`, {
    tenantName: `Sprint7 Store ${Date.now()}`,
    tenantEmail: `s7_${Date.now()}@test.com`,
    phone: '9000000007',
    userName: 'S7 Admin',
    password: 'password123'
  });
  const login = await axios.post(`${BASE_URL}/auth/login`, {
    email: reg.data.data.user.email,
    password: 'password123'
  });
  const headers = { Authorization: `Bearer ${login.data.data.token}` };
  const branchId = login.data.data.user.branchId;

  // Create product + customer for billing
  const prod = await axios.post(`${BASE_URL}/products`, {
    name: 'Payment Test Item',
    barcode: `PAY-${Date.now()}`,
    gst_rate: 0,
    base_unit: 'pcs',
    initial_quantity: 100,
    selling_price: 10000,   // ₹100
    purchase_price: 7000,
  }, { headers });
  const productId = prod.data.data.id;

  const cust = await axios.post(`${BASE_URL}/customers`, {
    name: 'Payment Test Customer',
    phone: `${Date.now()}`.slice(-10),
    credit_limit: 100000000,
  }, { headers });
  const customerId = cust.data.data.id;

  return { headers, branchId, productId, customerId };
}

async function createInvoice(headers, customerId, productId, qty, amountPaid) {
  const res = await axios.post(`${BASE_URL}/invoices`, {
    customer_id: customerId,
    items: [{ product_id: productId, quantity: qty, unit_price: 10000, gst_rate: 0 }],
    amount_paid: amountPaid,
  }, { headers });
  return res.data.data;
}

async function getCustomer(headers, id) {
  const res = await axios.get(`${BASE_URL}/customers/${id}`, { headers });
  return res.data.data;
}

async function runTests() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('  💰 SPRINT 7 — PAYMENT SYSTEM TESTS');
  console.log('═══════════════════════════════════════════════════════\n');

  const { headers, productId, customerId } = await setup();

  // ──────────────────────────────────────────────────────────
  // TEST 1: Simple Full Payment Against One Invoice
  // ──────────────────────────────────────────────────────────
  console.log('── TEST 1: Full Payment (single invoice) ──');
  {
    const inv = await createInvoice(headers, customerId, productId, 5, 0);
    // 5 × ₹100 = ₹500 due
    assert(Number(inv.amount_due) === 50000, `Invoice due = 500.00 (got ${inv.amount_due})`);

    const pay = await axios.post(`${BASE_URL}/payments`, {
      customer_id: customerId,
      amount: 50000,
      payment_mode: 'cash',
      allocations: [{ invoice_id: inv.id, allocated_amount: 50000 }]
    }, { headers });
    const payment = pay.data.data;

    assert(payment.status === 'fully_allocated', `Status = fully_allocated (got ${payment.status})`);
    assert(payment.unallocated_amount === 0, `Unallocated = 0 (got ${payment.unallocated_amount})`);
    assert(payment.allocations.length === 1, `1 allocation created`);

    // Invoice should now be paid
    const invDetail = await axios.get(`${BASE_URL}/invoices/${inv.id}`, { headers });
    assert(invDetail.data.data.status === 'paid', `Invoice status = paid`);
    assert(Number(invDetail.data.data.amount_due) === 0, `Invoice amount_due = 0`);

    // Customer total_due should be 0
    const cust = await getCustomer(headers, customerId);
    assert(Number(cust.total_due) === 0, `Customer total_due = 0 after full payment`);
  }

  // ──────────────────────────────────────────────────────────
  // TEST 2: Partial Payment (Invoice stays partial)
  // ──────────────────────────────────────────────────────────
  console.log('\n── TEST 2: Partial Payment ──');
  {
    const inv = await createInvoice(headers, customerId, productId, 3, 0);
    // 3 × ₹100 = ₹300 due

    const pay = await axios.post(`${BASE_URL}/payments`, {
      customer_id: customerId,
      amount: 20000, // Pay ₹200 of ₹300
      payment_mode: 'upi',
      allocations: [{ invoice_id: inv.id, allocated_amount: 20000 }]
    }, { headers });
    const payment = pay.data.data;

    assert(payment.status === 'fully_allocated', `Payment fully allocated (₹200 of ₹200)`);

    const invDetail = await axios.get(`${BASE_URL}/invoices/${inv.id}`, { headers });
    assert(invDetail.data.data.status === 'partial', `Invoice status = partial`);
    assert(Number(invDetail.data.data.amount_due) === 10000, `Invoice due = 100.00 (got ${invDetail.data.data.amount_due})`);

    const cust = await getCustomer(headers, customerId);
    assert(Number(cust.total_due) === 10000, `Customer total_due = 100.00 (got ${cust.total_due})`);
  }

  // ──────────────────────────────────────────────────────────
  // TEST 3: Advance Payment (No Allocation — Unallocated Balance)
  // ──────────────────────────────────────────────────────────
  console.log('\n── TEST 3: Advance Payment (no invoices yet) ──');
  {
    const pay = await axios.post(`${BASE_URL}/payments`, {
      customer_id: customerId,
      amount: 50000, // Customer pays ₹500 in advance
      payment_mode: 'bank_transfer',
      reference_number: 'NEFT-XYZ-123',
      allocations: [] // No allocation yet
    }, { headers });
    const payment = pay.data.data;

    assert(payment.status === 'received', `Advance payment status = received (got ${payment.status})`);
    assert(payment.unallocated_amount === 50000, `Unallocated = 500.00 (got ${payment.unallocated_amount})`);
    assert(payment.reference_number === 'NEFT-XYZ-123', 'Reference number stored');
    assert(payment.allocations.length === 0, 'No allocations yet');

    // Now create an invoice and allocate the advance payment
    const inv = await createInvoice(headers, customerId, productId, 2, 0);
    // 2 × ₹100 = ₹200

    const allocated = await axios.post(`${BASE_URL}/payments/${payment.id}/allocate`, {
      allocations: [{ invoice_id: inv.id, allocated_amount: 20000 }]
    }, { headers });

    assert(allocated.data.data.unallocated_amount === 30000, `After allocation: unallocated = 300.00 (got ${allocated.data.data.unallocated_amount})`);
    assert(allocated.data.data.status === 'partially_allocated', `Status = partially_allocated`);
    assert(allocated.data.data.allocations.length === 1, '1 allocation now exists');

    const invDetail = await axios.get(`${BASE_URL}/invoices/${inv.id}`, { headers });
    assert(invDetail.data.data.status === 'paid', `Invoice paid via advance allocation`);
  }

  // ──────────────────────────────────────────────────────────
  // TEST 4: One Payment → Multiple Invoices
  // ──────────────────────────────────────────────────────────
  console.log('\n── TEST 4: One Payment Across Multiple Invoices ──');
  {
    const inv1 = await createInvoice(headers, customerId, productId, 1, 0); // ₹100
    const inv2 = await createInvoice(headers, customerId, productId, 2, 0); // ₹200
    const inv3 = await createInvoice(headers, customerId, productId, 3, 0); // ₹300
    // Total = ₹600

    const pay = await axios.post(`${BASE_URL}/payments`, {
      customer_id: customerId,
      amount: 60000,
      payment_mode: 'cash',
      allocations: [
        { invoice_id: inv1.id, allocated_amount: 10000 },
        { invoice_id: inv2.id, allocated_amount: 20000 },
        { invoice_id: inv3.id, allocated_amount: 30000 },
      ]
    }, { headers });
    const payment = pay.data.data;

    assert(payment.status === 'fully_allocated', `Multi-invoice payment fully allocated`);
    assert(payment.allocations.length === 3, `3 allocations created (got ${payment.allocations.length})`);

    const [d1, d2, d3] = await Promise.all([
      axios.get(`${BASE_URL}/invoices/${inv1.id}`, { headers }),
      axios.get(`${BASE_URL}/invoices/${inv2.id}`, { headers }),
      axios.get(`${BASE_URL}/invoices/${inv3.id}`, { headers }),
    ]);
    assert(d1.data.data.status === 'paid', 'Invoice 1 = paid');
    assert(d2.data.data.status === 'paid', 'Invoice 2 = paid');
    assert(d3.data.data.status === 'paid', 'Invoice 3 = paid');
  }

  // ──────────────────────────────────────────────────────────
  // TEST 5: Over-allocation Rejected
  // ──────────────────────────────────────────────────────────
  console.log('\n── TEST 5: Over-Allocation Rejected ──');
  {
    const inv = await createInvoice(headers, customerId, productId, 1, 0); // ₹100 due

    try {
      await axios.post(`${BASE_URL}/payments`, {
        customer_id: customerId,
        amount: 5000, // ₹50 payment
        payment_mode: 'cash',
        allocations: [{ invoice_id: inv.id, allocated_amount: 15000 }] // Trying to allocate ₹150
      }, { headers });
      assert(false, 'Should reject over-allocation');
    } catch (err) {
      assert(err.response.status === 400, `Over-allocation → 400 (got ${err.response.status})`);
    }
  }

  // ──────────────────────────────────────────────────────────
  // TEST 6: Allocate to Cancelled Invoice Rejected
  // ──────────────────────────────────────────────────────────
  console.log('\n── TEST 6: Allocation to Cancelled Invoice Rejected ──');
  {
    const inv = await createInvoice(headers, customerId, productId, 1, 0);
    await axios.delete(`${BASE_URL}/invoices/${inv.id}`, { headers }); // Cancel it

    try {
      await axios.post(`${BASE_URL}/payments`, {
        customer_id: customerId,
        amount: 10000,
        payment_mode: 'cash',
        allocations: [{ invoice_id: inv.id, allocated_amount: 10000 }]
      }, { headers });
      assert(false, 'Should reject cancelled invoice allocation');
    } catch (err) {
      assert(err.response.status === 400, `Cancelled invoice → 400 (got ${err.response.status})`);
    }
  }

  // ──────────────────────────────────────────────────────────
  // TEST 7: Allocate to Already Paid Invoice Rejected
  // ──────────────────────────────────────────────────────────
  console.log('\n── TEST 7: Allocation to Fully Paid Invoice Rejected ──');
  {
    const inv = await createInvoice(headers, customerId, productId, 1, 10000); // Already fully paid
    assert(inv.status === 'paid', `Invoice is paid`);

    try {
      await axios.post(`${BASE_URL}/payments`, {
        customer_id: customerId,
        amount: 10000,
        payment_mode: 'cash',
        allocations: [{ invoice_id: inv.id, allocated_amount: 10000 }]
      }, { headers });
      assert(false, 'Should reject already paid invoice');
    } catch (err) {
      assert(err.response.status === 400, `Already paid invoice → 400 (got ${err.response.status})`);
    }
  }

  // ──────────────────────────────────────────────────────────
  // TEST 8: GET Payment Detail with Allocations
  // ──────────────────────────────────────────────────────────
  console.log('\n── TEST 8: GET Payment Detail ──');
  {
    const inv = await createInvoice(headers, customerId, productId, 2, 0);
    const pay = await axios.post(`${BASE_URL}/payments`, {
      customer_id: customerId,
      amount: 20000,
      payment_mode: 'card',
      allocations: [{ invoice_id: inv.id, allocated_amount: 20000 }]
    }, { headers });
    const paymentId = pay.data.data.id;

    const detail = await axios.get(`${BASE_URL}/payments/${paymentId}`, { headers });
    assert(detail.data.data.id === paymentId, 'Payment ID matches');
    assert(detail.data.data.payment_mode === 'card', `Mode = card`);
    assert(Array.isArray(detail.data.data.allocations), 'Has allocations array');
    assert(detail.data.data.allocations.length === 1, `1 allocation (got ${detail.data.data.allocations.length})`);
  }

  // ──────────────────────────────────────────────────────────
  // TEST 9: List Payments (Pagination)
  // ──────────────────────────────────────────────────────────
  console.log('\n── TEST 9: List Payments (Pagination) ──');
  {
    const list = await axios.get(`${BASE_URL}/payments?page=1&limit=5`, { headers });
    assert(list.data.pagination !== undefined, 'Pagination metadata present');
    assert(list.data.pagination.page === 1, 'Page = 1');
    assert(list.data.data.length <= 5, `Results ≤ 5 (got ${list.data.data.length})`);
    assert(list.data.pagination.total > 0, `Total > 0 (got ${list.data.pagination.total})`);
  }

  // ──────────────────────────────────────────────────────────
  // TEST 10: Anonymous Payment (No Customer)
  // ──────────────────────────────────────────────────────────
  console.log('\n── TEST 10: Anonymous Payment (Walk-in) ──');
  {
    const inv = await createInvoice(headers, null, productId, 1, 0);

    const pay = await axios.post(`${BASE_URL}/payments`, {
      amount: 10000,
      payment_mode: 'cash',
      allocations: [{ invoice_id: inv.id, allocated_amount: 10000 }]
    }, { headers });

    assert(pay.data.data.customer_id === null, 'Customer ID is null for anonymous payment');
    assert(pay.data.data.status === 'fully_allocated', 'Anonymous payment fully allocated');
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
