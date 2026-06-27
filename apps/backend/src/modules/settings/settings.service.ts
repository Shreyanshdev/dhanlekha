import { SettingRepository } from '../../repositories/setting.repo';
import { withTransaction } from '../../database/transaction';
import type { UpdateSettingsInput } from './settings.validator';

/**
 * Get all settings for a tenant as a flat key/value map.
 */
export async function getSettings(tenantId: string): Promise<Record<string, string>> {
  const repo = new SettingRepository(tenantId);
  const rows = await repo.findAll();
  return rows.reduce<Record<string, string>>((acc, row) => {
    acc[row.key] = row.value;
    return acc;
  }, {});
}

/**
 * Upsert one or more settings, then return the full settings map.
 */
export async function updateSettings(
  tenantId: string,
  data: UpdateSettingsInput
): Promise<Record<string, string>> {
  await withTransaction(async (trx) => {
    const repo = new SettingRepository(tenantId, trx);
    for (const [key, value] of Object.entries(data)) {
      await repo.upsert(key, value);
    }
  });

  return getSettings(tenantId);
}
