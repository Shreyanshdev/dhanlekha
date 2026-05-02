import { v4 as uuidv4 } from 'uuid';
import { BranchRepository } from '../../repositories/branch.repo';
import type { CreateBranchInput, UpdateBranchInput } from './branches.validator';
import type { Branch } from '@dhanlekha/shared';
import { NotFoundError, ForbiddenError } from '../../utils/errors';

export async function getBranches(tenantId: string): Promise<Branch[]> {
  const repo = new BranchRepository(tenantId);
  return await repo.findAll();
}

export async function createBranch(tenantId: string, data: CreateBranchInput): Promise<Branch> {
  const repo = new BranchRepository(tenantId);
  
  // TODO: Check max_branches quota from usage_tracking
  
  const branch: Branch = {
    id: uuidv4(),
    tenant_id: tenantId,
    name: data.name,
    address: data.address || null,
    phone: data.phone || null,
    is_active: true,
    is_deleted: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  await repo.create(branch);
  return branch;
}

export async function updateBranch(tenantId: string, id: string, data: UpdateBranchInput): Promise<Branch> {
  const repo = new BranchRepository(tenantId);
  const branch = await repo.findById(id);
  
  if (!branch) {
    throw new NotFoundError('Branch not found');
  }

  const updatedData = {
    ...data,
    updated_at: new Date().toISOString(),
  };

  await repo.update(id, updatedData);
  return { ...branch, ...updatedData } as Branch;
}

export async function deleteBranch(tenantId: string, id: string): Promise<void> {
  const repo = new BranchRepository(tenantId);
  const branch = await repo.findById(id);
  
  if (!branch) {
    throw new NotFoundError('Branch not found');
  }

  // Check if it's the only branch? Maybe prevent deleting the last branch.
  
  await repo.softDelete(id);
}
