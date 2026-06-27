import { z } from 'zod';

/**
 * Settings are stored as tenant-scoped key/value pairs. The PATCH body is a flat
 * object of string keys → string values (e.g. `{ "invoice_prefix": "INV", "gst_number": "..." }`).
 * Values are stored as strings; callers serialise non-string config themselves.
 */
export const updateSettingsSchema = z
  .record(z.string().min(1), z.string().max(2000))
  .refine((obj) => Object.keys(obj).length > 0, {
    message: 'At least one setting must be provided',
  });

export type UpdateSettingsInput = z.infer<typeof updateSettingsSchema>;
