import { z } from 'zod';

export const changePlanSchema = z.object({
  plan_id: z.string().min(1, 'plan_id is required'),
});

export type ChangePlanInput = z.infer<typeof changePlanSchema>;
