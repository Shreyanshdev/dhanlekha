import { v4 as uuidv4 } from 'uuid';
import { SupplierRepository } from '../../repositories/supplier.repo';
import { NotFoundError, ConflictError } from '../../utils/errors';
import type { Supplier } from '@dhanlekha/shared';
import type { CreateSupplierInput, UpdateSupplierInput } from './suppliers.validator';

export async function listSuppliers(tenantId: string, query?: string): Promise<Supplier[]> {
  const repo = new SupplierRepository(tenantId);
  if (query) {
    return await repo.search(query);
  }
  return await repo.findAll();
}

export async function getSupplierById(tenantId: string, supplierId: string): Promise<Supplier> {
  const repo = new SupplierRepository(tenantId);
  const supplier = await repo.findById(supplierId);
  if (!supplier) {
    throw new NotFoundError('Supplier');
  }
  return supplier;
}

export async function createSupplier(tenantId: string, data: CreateSupplierInput): Promise<Supplier> {
  const repo = new SupplierRepository(tenantId);

  // If GST provided, check for uniqueness within the tenant
  if (data.gst_number) {
    const existing = await repo.findByGst(data.gst_number);
    if (existing) {
      throw new ConflictError(`Supplier with GST '${data.gst_number}' already exists`);
    }
  }

  const id = uuidv4();
  await repo.create({
    id,
    tenant_id: tenantId,
    name: data.name,
    phone: data.phone || null,
    address: data.address || null,
    gst_number: data.gst_number || null,
    is_deleted: false,
  });

  return await getSupplierById(tenantId, id);
}

export async function updateSupplier(tenantId: string, id: string, data: UpdateSupplierInput): Promise<Supplier> {
  const repo = new SupplierRepository(tenantId);
  const existing = await repo.findById(id);
  if (!existing) {
    throw new NotFoundError('Supplier');
  }

  if (data.gst_number && data.gst_number !== existing.gst_number) {
    const conflict = await repo.findByGst(data.gst_number);
    if (conflict) {
      throw new ConflictError(`Supplier with GST '${data.gst_number}' already exists`);
    }
  }

  await repo.update(id, data as Partial<Supplier>);
  return await getSupplierById(tenantId, id);
}

export async function deleteSupplier(tenantId: string, id: string): Promise<void> {
  const repo = new SupplierRepository(tenantId);
  const existing = await repo.findById(id);
  if (!existing) {
    throw new NotFoundError('Supplier');
  }
  await repo.softDelete(id);
}
