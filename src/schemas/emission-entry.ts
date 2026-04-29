import { z } from 'zod';

// ─── Raw DB schema (used by legacy create/update procedures) ──────────────────

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

// ─── Form input schema (used by calculateAndPreview + createEntry) ─────────────
// Uses categoryCode ('SCOPE1_GAS') instead of categoryId so forms don't need
// to know DB IDs. tCO2e and emissionFactorId are computed server-side.

export const EmissionEntryFormInputSchema = z.object({
  locationId: z.string(),
  reportingPeriodId: z.string(),
  enteredById: z.string(),
  /** EmissionCategory.code — e.g. 'SCOPE1_GAS', 'SCOPE2_ELECTRICITY' */
  categoryCode: z.string(),
  /**
   * Optional subcategory for factor resolution when a category has multiple
   * factors (e.g. 'diesel' vs 'LPG' within SCOPE1_VEHICLE_FUEL).
   * Matched as a substring against EmissionFactor.factorName.
   */
  factorName: z.string().optional(),
  activityValue: z.number().positive('Activity value must be greater than zero'),
  unit: z.string(),
  notes: z.string().optional(),
  status: z.enum(['DRAFT', 'COMPLETE', 'APPROVED']).default('DRAFT'),
  dataSource: z.enum(['MANUAL', 'AUTO', 'SURVEY', 'IMPORTED']).default('MANUAL'),
  dataQuality: z.enum(['PRIMARY', 'ESTIMATED', 'MODELLED']).default('PRIMARY'),
  evidenceRef: z.string().optional(),
  // Scope 2 only — ignored for all other categories
  supplierName: z.string().optional(),
  isREGOBacked: z.boolean().optional(),
});

export type EmissionEntryFormInput = z.infer<typeof EmissionEntryFormInputSchema>;
