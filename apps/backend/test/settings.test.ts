import { describe, it, expect, beforeAll } from 'vitest';
import { app, request, registerAndLogin, bearer, uniqueEmail, type AuthContext } from './helpers';

/**
 * Sprint 17 — tenant settings module (GET any role, PATCH admin-only).
 */
describe('settings: GET/PATCH + admin gating', () => {
  let admin: AuthContext;
  let cashierToken: string;

  beforeAll(async () => {
    admin = await registerAndLogin();

    // Create a cashier staff user under the same tenant, then log them in.
    const cashierEmail = uniqueEmail('cashier');
    await request(app)
      .post('/api/v1/users')
      .set('Authorization', bearer(admin.token))
      .send({ name: 'Cashier Joe', email: cashierEmail, password: 'password123', role: 'cashier' })
      .expect(201);

    const login = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: cashierEmail, password: 'password123' })
      .expect(200);
    cashierToken = login.body.data.token;
  });

  it('returns an empty settings map for a fresh tenant', async () => {
    const res = await request(app)
      .get('/api/v1/settings')
      .set('Authorization', bearer(admin.token))
      .expect(200);
    expect(res.body.data).toEqual({});
  });

  it('lets an admin upsert settings and reads them back', async () => {
    const patch = await request(app)
      .patch('/api/v1/settings')
      .set('Authorization', bearer(admin.token))
      .send({ invoice_prefix: 'SHOP', gst_number: '29ABCDE1234F1Z5' })
      .expect(200);

    expect(patch.body.data.invoice_prefix).toBe('SHOP');
    expect(patch.body.data.gst_number).toBe('29ABCDE1234F1Z5');

    const get = await request(app)
      .get('/api/v1/settings')
      .set('Authorization', bearer(admin.token))
      .expect(200);
    expect(get.body.data.invoice_prefix).toBe('SHOP');
  });

  it('upserts (overwrites) an existing key instead of duplicating it', async () => {
    await request(app)
      .patch('/api/v1/settings')
      .set('Authorization', bearer(admin.token))
      .send({ invoice_prefix: 'STORE' })
      .expect(200);

    const get = await request(app)
      .get('/api/v1/settings')
      .set('Authorization', bearer(admin.token))
      .expect(200);
    expect(get.body.data.invoice_prefix).toBe('STORE');
  });

  it('lets a cashier READ settings', async () => {
    await request(app)
      .get('/api/v1/settings')
      .set('Authorization', bearer(cashierToken))
      .expect(200);
  });

  it('forbids a cashier from WRITING settings (403)', async () => {
    const res = await request(app)
      .patch('/api/v1/settings')
      .set('Authorization', bearer(cashierToken))
      .send({ invoice_prefix: 'HACK' })
      .expect(403);
    expect(res.body.success).toBe(false);
  });

  it('rejects an empty PATCH body (validation)', async () => {
    await request(app)
      .patch('/api/v1/settings')
      .set('Authorization', bearer(admin.token))
      .send({})
      .expect(400);
  });

  it('requires authentication', async () => {
    await request(app).get('/api/v1/settings').expect(401);
  });
});
