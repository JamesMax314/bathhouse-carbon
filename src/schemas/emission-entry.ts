import { z } from 'zod';

export const CreateEmissionEntrySchema = z.object({
  locationId: z.string(),
  reportingPeriodId: z.string(),
  categoryId: z.string(),
  enteredById: z.string(),
  emissionFactorId: z.string().optional(),
  activityValue: z.number().positive('Activity value must be greater than zero'),
  unit: z.string(),
  tCO2e: z.number().nonnegative('tCO₂e cannot be negative'),
  notes: z.string().optional(),
  status: z.enum(['DRAFT', 'COMPLETE', 'APPROVED']).default('DRAFT'),
  dataSource: z.enum(['MANUAL', 'AUTO', 'SURVEY', 'IMPORTED']).default('MANUAL'),
  dataQuality: z.enum(['PRIMARY', 'ESTIMATED', 'MODELLED']).default('PRIMARY'),
  evidenceRef: z.string().optional(),
  supplierName: z.string().optional(),
  isREGOBacked: z.boolean().optional(),
  tCO2eMarketBased: z.number().nonnegative().optional(),
});

export const UpdateEmissionEntrySchema = CreateEmissionEntrySchema.partial().extend({
  id: z.string(),
});

export type CreateEmissionEntryInput = z.infer<typeof CreateEmissionEntrySchema>;
export type UpdateEmissionEntryInput = z.infer<typeof UpdateEmissionEntrySchema>;
