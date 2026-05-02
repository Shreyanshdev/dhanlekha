import { v4 as uuidv4 } from 'uuid';
import { ProductRepository } from '../../repositories/product.repo';
import { InventoryRepository, InventoryLogRepository } from '../../repositories/inventory.repo';
import { withTransaction } from '../../database/transaction';
import { NotFoundError, ConflictError } from '../../utils/errors';
import type { Product, Inventory, InventoryLog } from '@dhanlekha/shared';
import type { CreateProductInput, UpdateProductInput, AdjustInventoryInput } from './products.validator';

/**
 * List all products for a tenant
 */
export async function listProducts(tenantId: string, query?: string): Promise<Product[]> {
  const repo = new ProductRepository(tenantId);
  if (query) {
    return await repo.search(query);
  }
  return await repo.findAll();
}

/**
 * Sprint 6: Optimized barcode lookup — returns product + branch inventory in ONE response.
 * Target: Sub-50ms for instant billing.
 */
export async function findProductByBarcode(tenantId: string, branchId: string, barcode: string) {
  const productRepo = new ProductRepository(tenantId);
  const product = await productRepo.findByBarcode(barcode);
  if (!product) {
    throw new NotFoundError(`Product with barcode '${barcode}'`);
  }

  // Fetch branch-specific inventory (price + stock) in parallel
  const inventoryRepo = new InventoryRepository(tenantId, branchId);
  const inventory = await inventoryRepo.findById(product.id);

  return {
    id: product.id,
    name: product.name,
    barcode: product.barcode,
    gst_rate: product.gst_rate,
    hsn_code: product.hsn_code,
    base_unit: product.base_unit,
    category: product.category,
    // Inventory data for instant billing
    selling_price: inventory ? Number(inventory.selling_price) : 0,
    purchase_price: inventory ? Number(inventory.purchase_price) : 0,
    total_quantity: inventory ? Number(inventory.total_quantity) : 0,
    in_stock: inventory ? Number(inventory.total_quantity) > 0 : false,
  };
}

/**
 * Create a new product and its initial inventory row atomically for a specific branch
 */
export async function createProduct(tenantId: string, branchId: string, userId: string, data: CreateProductInput): Promise<Product> {
  return await withTransaction(async (trx) => {
    const productRepo = new ProductRepository(tenantId, trx);
    const inventoryRepo = new InventoryRepository(tenantId, branchId, trx);
    const logRepo = new InventoryLogRepository(tenantId, branchId, trx);

    // If barcode provided, check for uniqueness
    if (data.barcode) {
      const existing = await productRepo.findByBarcode(data.barcode);
      if (existing) {
        throw new ConflictError(`Product with barcode ${data.barcode} already exists`);
      }
    }

    const productId = uuidv4();

    // 1. Create Product
    const productData: Partial<Product> = {
      id: productId,
      name: data.name,
      barcode: data.barcode || null,
      gst_rate: data.gst_rate,
      hsn_code: data.hsn_code || null,
      base_unit: data.base_unit,
      category: data.category || null,
      is_deleted: false
    };
    await productRepo.create(productData);

    // 2. Create Inventory
    const inventoryData: Partial<Inventory> = {
      product_id: productId,
      total_quantity: data.initial_quantity,
      selling_price: data.selling_price,
      purchase_price: data.purchase_price,
      min_stock_alert: data.min_stock_alert
    };
    await inventoryRepo.create(inventoryData);

    // 3. Create Audit Log if there's initial stock
    if (data.initial_quantity > 0) {
      const logData: Partial<InventoryLog> = {
        id: uuidv4(),
        product_id: productId,
        change_type: 'adjustment', // Initial stock treated as adjustment
        quantity_change: data.initial_quantity,
        reference_id: null,
        notes: 'Initial stock entry during product creation',
        created_by: userId
      };
      await logRepo.create(logData);
    }

    // Fetch the newly created product to return
    return (await productRepo.findById(productId)) as Product;
  });
}

/**
 * Update an existing product
 */
export async function updateProduct(tenantId: string, productId: string, data: UpdateProductInput): Promise<Product> {
  const repo = new ProductRepository(tenantId);
  const existing = await repo.findById(productId);
  if (!existing) {
    throw new NotFoundError('Product not found');
  }

  // Barcode uniqueness check
  if (data.barcode && data.barcode !== existing.barcode) {
    const conflict = await repo.findByBarcode(data.barcode);
    if (conflict) {
      throw new ConflictError(`Product with barcode ${data.barcode} already exists`);
    }
  }

  await repo.update(productId, data);
  return (await repo.findById(productId)) as Product;
}

/**
 * Soft delete a product
 */
export async function deleteProduct(tenantId: string, productId: string): Promise<void> {
  const repo = new ProductRepository(tenantId);
  const existing = await repo.findById(productId);
  if (!existing) {
    throw new NotFoundError('Product not found');
  }
  
  await repo.softDelete(productId);
}

/**
 * Manually adjust inventory (atomic) for a specific branch
 */
export async function adjustInventory(tenantId: string, branchId: string, userId: string, productId: string, data: AdjustInventoryInput): Promise<Inventory> {
  return await withTransaction(async (trx) => {
    const productRepo = new ProductRepository(tenantId, trx);
    const inventoryRepo = new InventoryRepository(tenantId, branchId, trx);
    const logRepo = new InventoryLogRepository(tenantId, branchId, trx);

    // Check product exists
    const product = await productRepo.findById(productId);
    if (!product) {
      throw new NotFoundError('Product not found');
    }

    if (data.quantity_change > 0) {
      await inventoryRepo.incrementStock(productId, data.quantity_change);
    } else if (data.quantity_change < 0) {
      // decrement takes a positive number
      await inventoryRepo.decrementStock(productId, Math.abs(data.quantity_change));
    }

    // Always log the adjustment
    await logRepo.create({
      id: uuidv4(),
      product_id: productId,
      change_type: 'adjustment',
      quantity_change: data.quantity_change,
      reference_id: null,
      notes: data.notes,
      created_by: userId
    });

    return (await inventoryRepo.findById(productId)) as Inventory;
  });
}

/**
 * Get low stock alerts for a branch
 */
export async function getLowStockAlerts(tenantId: string, branchId: string): Promise<Inventory[]> {
  const inventoryRepo = new InventoryRepository(tenantId, branchId);
  return await inventoryRepo.getLowStock(50);
}
