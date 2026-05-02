import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { ConflictError, AuthenticationError } from '../../utils/errors';
import { withTransaction } from '../../database/transaction';
import { TenantRepository } from '../../repositories/tenant.repo';
import { UserRepository } from '../../repositories/user.repo';
import env from '../../config/env';

/**
 * Register a new tenant + admin user in a single atomic transaction.
 * Creates: tenant, admin user, and default invoice sequence.
 */
export async function registerTenant(data: any) {
  const { tenantName, tenantEmail, phone, planId, userName, password } = data;

  return await withTransaction(async (trx) => {
    const tenantRepo = new TenantRepository(trx);

    // Check for duplicate tenant email
    const existingTenant = await tenantRepo.findByEmail(tenantEmail);
    if (existingTenant) {
      throw new ConflictError('Tenant email is already registered');
    }

    const tenantId = uuidv4();
    const userId = uuidv4();

    // Create Tenant
    await tenantRepo.create({
      id: tenantId,
      name: tenantName,
      email: tenantEmail,
      phone: phone || null,
      plan_id: planId || 'starter',
      status: 'active',
    } as any);

    // Hash Password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // Create Admin User (via UserRepository scoped to the new tenant)
    const userRepo = new UserRepository(tenantId, trx);
    await userRepo.create({
      id: userId,
      name: userName,
      email: tenantEmail,
      password_hash: passwordHash,
      role: 'admin',
    } as any);

    // Create default invoice sequence (global insert via trx)
    // NOTE: invoice_sequences doesn't have its own repo yet — will get one in Sprint 5
    await trx('invoice_sequences').insert({
      id: uuidv4(),
      tenant_id: tenantId,
      prefix: 'INV',
      next_number: 1,
    });

    return {
      tenant: { id: tenantId, name: tenantName, planId: planId || 'starter' },
      user: { id: userId, name: userName, email: tenantEmail, role: 'admin' },
    };
  });
}

/**
 * Authenticate a user by email + password, return JWT.
 * Uses cross-tenant email lookup since we don't know tenant at login time.
 */
export async function login(data: any) {
  const { email, password } = data;

  // Cross-tenant email lookup (login doesn't know tenant yet)
  const userRepo = new UserRepository('');
  const user = await userRepo.findByEmailGlobal(email);

  if (!user) {
    throw new AuthenticationError('Invalid email or password');
  }

  // Verify password
  const isValidPassword = await bcrypt.compare(password, user.password_hash);
  if (!isValidPassword) {
    throw new AuthenticationError('Invalid email or password');
  }

  // Check tenant is active
  const tenantRepo = new TenantRepository();
  const tenant = await tenantRepo.findById(user.tenant_id);

  if (!tenant || tenant.status !== 'active') {
    throw new AuthenticationError('Account is suspended or deleted');
  }

  // Generate JWT
  const token = jwt.sign(
    {
      userId: user.id,
      tenantId: user.tenant_id,
      role: user.role,
    },
    env.jwt.secret,
    { expiresIn: env.jwt.expiresIn as any }
  );

  return {
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      tenantId: user.tenant_id,
    },
  };
}
