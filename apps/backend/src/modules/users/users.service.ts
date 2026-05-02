import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';
import { ConflictError, NotFoundError, BusinessRuleError } from '../../utils/errors';
import { UserRepository } from '../../repositories/user.repo';
import type { UserPublic } from '@dhanlekha/shared';
import type { CreateUserInput, UpdateUserInput } from './users.validator';

/**
 * List all staff users for a tenant (safe projection — no password_hash).
 */
export async function listUsers(tenantId: string): Promise<UserPublic[]> {
  const repo = new UserRepository(tenantId);
  return await repo.findAllSafe();
}

/**
 * Get a single user by ID, scoped to tenant (safe projection).
 */
export async function getUserById(tenantId: string, userId: string): Promise<UserPublic> {
  const repo = new UserRepository(tenantId);
  const user = await repo.findByIdSafe(userId);

  if (!user) {
    throw new NotFoundError('User');
  }

  return user;
}

/**
 * Create a new staff user under a tenant (admin only).
 */
export async function createUser(tenantId: string, data: CreateUserInput): Promise<UserPublic> {
  const repo = new UserRepository(tenantId);
  const { name, email, password, role } = data;

  // Check for duplicate email within this tenant
  const existing = await repo.findByEmail(email);
  if (existing) {
    throw new ConflictError(`A user with email '${email}' already exists in this tenant`);
  }

  const userId = uuidv4();
  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash(password, salt);

  await repo.create({
    id: userId,
    tenant_id: tenantId,
    branch_id: data.branch_id || null,
    name,
    email,
    password_hash: passwordHash,
    role,
  } as any);

  return {
    id: userId,
    tenant_id: tenantId,
    branch_id: data.branch_id || null,
    name,
    email,
    role,
    created_at: new Date().toISOString(),
  };
}

/**
 * Update a staff user (scoped to tenant).
 * Cannot change the last admin to cashier (must always have at least one admin).
 */
export async function updateUser(tenantId: string, userId: string, data: UpdateUserInput): Promise<UserPublic> {
  const repo = new UserRepository(tenantId);

  // Fetch full user (with password_hash) for internal checks
  const user = await repo.findById(userId);
  if (!user) {
    throw new NotFoundError('User');
  }

  // If demoting admin → cashier, ensure at least 1 other admin remains
  if (data.role === 'cashier' && user.role === 'admin') {
    const adminCount = await repo.countByRole('admin');
    if (adminCount <= 1) {
      throw new BusinessRuleError('Cannot demote the last admin. At least one admin must exist.');
    }
  }

  // If changing email, check for duplicates within this tenant
  if (data.email && data.email !== user.email) {
    const existing = await repo.findByEmail(data.email);
    if (existing) {
      throw new ConflictError(`A user with email '${data.email}' already exists in this tenant`);
    }
  }

  // Build update payload (only provided fields)
  const updatePayload: Record<string, any> = {};
  if (data.name !== undefined) updatePayload.name = data.name;
  if (data.email !== undefined) updatePayload.email = data.email;
  if (data.role !== undefined) updatePayload.role = data.role;
  if (data.branch_id !== undefined) updatePayload.branch_id = data.branch_id;

  if (Object.keys(updatePayload).length > 0) {
    await repo.update(userId, updatePayload as any);
  }

  return await getUserById(tenantId, userId);
}

/**
 * Soft-delete a user (scoped to tenant).
 * Cannot delete the last admin.
 */
export async function deleteUser(tenantId: string, userId: string): Promise<void> {
  const repo = new UserRepository(tenantId);

  const user = await repo.findById(userId);
  if (!user) {
    throw new NotFoundError('User');
  }

  // Cannot delete the last admin
  if (user.role === 'admin') {
    const adminCount = await repo.countByRole('admin');
    if (adminCount <= 1) {
      throw new BusinessRuleError('Cannot delete the last admin. At least one admin must exist.');
    }
  }

  await repo.softDelete(userId);
}
