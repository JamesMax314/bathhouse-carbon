import { CalculationInputError } from '@/lib/errors'
import { EmissionFactorNotFoundError } from '@/lib/errors'

function assertPositive(value: number, field: string): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new CalculationInputError(field, `${field} must be a finite non-negative number, got ${value}`)
  }
}

/**
 * Scope 3 Category 1 — emissions from a single ingredient by weight.
 * Formula: weightKg × kgCO2ePerKg / 1000 = tCO2e
 * Factors sourced from Ecoinvent LCA database; DEFRA spend-based as fallback.
 * @see GHG Protocol Corporate Standard — Scope 3 Category 1 (Purchased Goods and Services)
 * @see Ecoinvent v3 — cosmetic raw material datasets
 */
export function calculateIngredientEmissions(
  weightKg: number,
  kgCO2ePerKg: number
): number {
  assertPositive(weightKg, 'weightKg')
  assertPositive(kgCO2ePerKg, 'kgCO2ePerKg')
  return (weightKg * kgCO2ePerKg) / 1000
}

export interface IngredientLine {
  inciName: string
  weightKg: number
  /** kgCO2e per kg from the factor library — must be pre-resolved. */
  kgCO2ePerKg: number | null
}

export interface BatchIngredientResult {
  tCO2e: number
  unmappedIngredients: string[]
}

/**
 * Aggregates ingredient emissions for a production batch.
 * Ingredients with a null factor (unmapped INCI entries) are excluded from the
 * total and returned in `unmappedIngredients`. The caller must surface this list
 * as an alert — never silently omit unmapped ingredients from reporting.
 * @see GHG Protocol Corporate Standard — Scope 3 Category 1
 */
export function calculateBatchIngredients(
  ingredients: IngredientLine[]
): BatchIngredientResult {
  const unmappedIngredients: string[] = []
  let tCO2e = 0

  for (const ingredient of ingredients) {
    if (ingredient.kgCO2ePerKg === null) {
      unmappedIngredients.push(ingredient.inciName)
      continue
    }
    tCO2e += calculateIngredientEmissions(ingredient.weightKg, ingredient.kgCO2ePerKg)
  }

  return { tCO2e, unmappedIngredients }
}

/**
 * Packaging material emissions — Scope 3 Category 1.
 * Formula: weightKg × kgCO2ePerKg / 1000 = tCO2e
 * @see DEFRA 2024 Greenhouse Gas Reporting: Conversion Factors, Table 10 (Material use)
 * @see GHG Protocol Corporate Standard — Scope 3 Category 1
 */
export function calculatePackagingEmissions(
  weightKg: number,
  kgCO2ePerKg: number
): number {
  assertPositive(weightKg, 'weightKg')
  assertPositive(kgCO2ePerKg, 'kgCO2ePerKg')
  return (weightKg * kgCO2ePerKg) / 1000
}

// Re-export so callers can catch both error types from one import path
export { EmissionFactorNotFoundError }
