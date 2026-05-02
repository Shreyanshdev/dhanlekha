import { v4 as uuidv4 } from 'uuid';
import { CustomerRepository } from '../../repositories/customer.repo';
import { NotFoundError, ConflictError } from '../../utils/errors';
import type { Customer } from '@dhanlekha/shared';
import type { CreateCustomerInput, UpdateCustomerInput } from './customers.validator';

export async function listCustomers(tenantId: string, query?: string): Promise<Customer[]> {
  const repo = new CustomerRepository(tenantId);
  if (query) {
    return await repo.search(query);
  }
  return await repo.findAll();
}

export async function getCustomerById(tenantId: string, customerId: string): Promise<Customer> {
  const repo = new CustomerRepository(tenantId);
  const customer = await repo.findById(customerId);
  if (!customer) {
    throw new NotFoundError('Customer');
  }
  return customer;
}

export async function createCustomer(tenantId: string, data: CreateCustomerInput): Promise<Customer> {
  const repo = new CustomerRepository(tenantId);

  // If phone provided, check for uniqueness within the tenant
  if (data.phone) {
    const existing = await repo.findByPhone(data.phone);
    if (existing) {
      throw new ConflictError(`Customer with phone '${data.phone}' already exists`);
    }
  }

  const id = uuidv4();
  await repo.create({
    id,
    tenant_id: tenantId,
    name: data.name,
    phone: data.phone || null,
    address: data.address || null,
    credit_limit: data.credit_limit,
    total_due: 0,
    is_deleted: false,
  } as any);

  return await getCustomerById(tenantId, id);
}

export async function updateCustomer(tenantId: string, id: string, data: UpdateCustomerInput): Promise<Customer> {
  const repo = new CustomerRepository(tenantId);
  const existing = await repo.findById(id);
  if (!existing) {
    throw new NotFoundError('Customer');
  }

  if (data.phone && data.phone !== existing.phone) {
    const conflict = await repo.findByPhone(data.phone);
    if (conflict) {
      throw new ConflictError(`Customer with phone '${data.phone}' already exists`);
    }
  }

  await repo.update(id, data as any);
  return await getCustomerById(tenantId, id);
}

export async function deleteCustomer(tenantId: string, id: string): Promise<void> {
  const repo = new CustomerRepository(tenantId);
  const existing = await repo.findById(id);
  if (!existing) {
    throw new NotFoundError('Customer');
  }
  await repo.softDelete(id);
}
