import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';
import db from '../../config/database';
import { ConflictError } from '../../utils/errors';
import { withTransaction } from '../../database/transaction';
import { TenantRepository } from '../../repositories/tenant.repo';
import { UserRepository } from '../../repositories/user.repo';

export async function registerTenant(data: any) {
  const { tenantName, tenantEmail, phone, planId, userName, password } = data;

  return await withTransaction(async (trx) => {
    // We instantiate repo here since tenantId is not yet created
    const tenantRepo = new TenantRepository(''); 

    // Check if email is already taken by another tenant
    const existingTenant = await tenantRepo.findByEmail(tenantEmail, trx);
    if (existingTenant) {
      throw new ConflictError('Tenant email is already registered');
    }

    const tenantId = uuidv4();
    const userId = uuidv4();

    // Create Tenant
    await trx('tenants').insert({
      id: tenantId,
      name: tenantName,
      email: tenantEmail,
      phone,
      plan_id: planId || 'starter',
      status: 'active',
    });

    // Hash Password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // Create Admin User
    const userRepo = new UserRepository(tenantId);
    await userRepo.create({
      id: userId,
      name: userName,
      email: tenantEmail, // Use the same email for the primary admin
      password_hash: passwordHash,
      role: 'admin',
    } as any, trx);

    return {
      tenant: { id: tenantId, name: tenantName, planId: planId || 'starter' },
      user: { id: userId, name: userName, role: 'admin' },
    };
  });
}
