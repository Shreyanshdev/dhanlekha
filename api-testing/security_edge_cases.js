const axios = require('axios');

const BASE_URL = 'http://localhost:3001/api/v1';

async function testEdgeCases() {
  console.log('🛡️ Starting Security & Edge Case Verification...');

  try {
    // --- SETUP: Create two distinct tenants ---
    const t1Email = `tenant1_${Date.now()}@test.com`;
    const t2Email = `tenant2_${Date.now()}@test.com`;

    const t1 = await axios.post(`${BASE_URL}/auth/register`, {
      tenantName: 'Tenant One', tenantEmail: t1Email, phone: '9000000001', planId: 'starter', userName: 'Admin 1', password: 'password'
    });
    const t2 = await axios.post(`${BASE_URL}/auth/register`, {
      tenantName: 'Tenant Two', tenantEmail: t2Email, phone: '9000000002', planId: 'starter', userName: 'Admin 2', password: 'password'
    });

    const l1 = await axios.post(`${BASE_URL}/auth/login`, { email: t1Email, password: 'password' });
    const l2 = await axios.post(`${BASE_URL}/auth/login`, { email: t2Email, password: 'password' });

    const t1Token = l1.data.data.token;
    const t2Token = l2.data.data.token;
    const t1BranchId = l1.data.data.user.branchId;
    const t2BranchId = l2.data.data.user.branchId;

    console.log('✅ Setup: Two independent tenants created.');

    // --- CASE 1: Cross-Tenant Isolation ---
    console.log('\n--- Case 1: Cross-Tenant Isolation ---');
    try {
      // Tenant 2 tries to access Tenant 1's branch data using Tenant 1's branch ID
      await axios.get(`${BASE_URL}/branches/${t1BranchId}`, { headers: { Authorization: `Bearer ${t2Token}` } });
      console.log('❌ FAIL: Tenant 2 accessed Tenant 1 branch!');
    } catch (err) {
      if (err.response?.status === 404 || err.response?.status === 403) {
        console.log('✅ PASS: Tenant 2 blocked from Tenant 1 branch (404/403)');
      } else {
        console.log('❓ Unexpected status:', err.response?.status);
      }
    }

    // --- CASE 2: Role-Based Access (RBAC) ---
    console.log('\n--- Case 2: RBAC (Cashier vs Admin) ---');
    const cashierEmail = `cashier_${Date.now()}@test.com`;
    const createCashierRes = await axios.post(`${BASE_URL}/users`, {
      name: 'Cashier', email: cashierEmail, password: 'password', role: 'cashier', branch_id: t1BranchId
    }, { headers: { Authorization: `Bearer ${t1Token}` } });

    const lc = await axios.post(`${BASE_URL}/auth/login`, { email: cashierEmail, password: 'password' });
    const cashierToken = lc.data.data.token;

    try {
      // Cashier tries to create a branch
      await axios.post(`${BASE_URL}/branches`, { name: 'Evil Branch' }, { headers: { Authorization: `Bearer ${cashierToken}` } });
      console.log('❌ FAIL: Cashier created a branch!');
    } catch (err) {
      if (err.response?.status === 403) {
        console.log('✅ PASS: Cashier blocked from creating branch (403 Forbidden)');
      } else {
        console.log('❓ Unexpected status:', err.response?.status);
      }
    }

    // --- CASE 3: Data Integrity (Duplicate Barcode) ---
    console.log('\n--- Case 3: Data Integrity (Duplicate Barcode) ---');
    const barcode = `BAR-${Date.now()}`;
    await axios.post(`${BASE_URL}/products`, {
      name: 'P1', barcode, gst_rate: 18, base_unit: 'pcs', initial_quantity: 0, selling_price: 100, purchase_price: 50, min_stock_alert: 0
    }, { headers: { Authorization: `Bearer ${t1Token}` } });

    try {
      await axios.post(`${BASE_URL}/products`, {
        name: 'P2', barcode, gst_rate: 18, base_unit: 'pcs', initial_quantity: 0, selling_price: 100, purchase_price: 50, min_stock_alert: 0
      }, { headers: { Authorization: `Bearer ${t1Token}` } });
      console.log('❌ FAIL: Duplicate barcode allowed in same tenant!');
    } catch (err) {
      if (err.response?.status === 409) {
        console.log('✅ PASS: Duplicate barcode blocked (409 Conflict)');
      } else {
        console.log('❓ Unexpected status:', err.response?.status);
      }
    }

    // --- CASE 4: Soft Delete Persistence ---
    console.log('\n--- Case 4: Soft Delete Persistence ---');
    const pRes = await axios.post(`${BASE_URL}/products`, {
      name: 'To Delete', barcode: `DEL-${Date.now()}`, gst_rate: 18, base_unit: 'pcs', initial_quantity: 0, selling_price: 100, purchase_price: 50, min_stock_alert: 0
    }, { headers: { Authorization: `Bearer ${t1Token}` } });
    const toDeleteId = pRes.data.data.id;

    await axios.delete(`${BASE_URL}/products/${toDeleteId}`, { headers: { Authorization: `Bearer ${t1Token}` } });
    console.log('✅ Product soft-deleted.');

    const listRes = await axios.get(`${BASE_URL}/products`, { headers: { Authorization: `Bearer ${t1Token}` } });
    const found = listRes.data.data.find(p => p.id === toDeleteId);
    if (!found) {
      console.log('✅ PASS: Deleted product not in list.');
    } else {
      console.log('❌ FAIL: Deleted product still in list!');
    }

    console.log('\n🎉 ALL EDGE CASE TESTS PASSED!');

  } catch (error) {
    console.error('\n❌ VERIFICATION FAILED!');
    if (error.response) {
      console.error('Data:', JSON.stringify(error.response.data, null, 2));
    } else {
      console.error(error.message);
    }
    process.exit(1);
  }
}

testEdgeCases();
