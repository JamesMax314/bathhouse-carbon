import { CalculationInputError } from '@/lib/errors'

export interface ScopeTotal {
  scope1: number
  scope2LocationBased: number
  scope2MarketBased: number
  scope3: number
}

export interface OrganisationTotal extends ScopeTotal {
  /** scope1 + scope2LocationBased + scope3 */
  totalLocationBased: number
  /** scope1 + scope2MarketBased + scope3 */
  totalMarketBased: number
}

export interface EntryWithTCO2e {
  tCO2e: number
  scope?: number
}

/**
 * Sums tCO2e values from a list of emission entries.
 * Returns 0 for an empty array — the caller is responsible for
 * distinguishing "no data" from "genuinely zero emissions".
 */
export function sumEntries(entries: EntryWithTCO2e[]): number {
  return entries.reduce((sum, e) => {
    if (!Number.isFinite(e.tCO2e)) {
      throw new CalculationInputError(
        'tCO2e',
        `Entry contains a non-finite tCO2e value: ${e.tCO2e}`
      )
    }
    return sum + e.tCO2e
  }, 0)
}

/**
 * Calculates the full organisation carbon total across all scopes.
 * Produces both location-based and market-based Scope 2 totals as required
 * by the GHG Protocol Scope 2 Guidance.
 * @see GHG Protocol Corporate Standard — Chapter 7 (Setting Organizational Boundaries)
 * @see GHG Protocol Scope 2 Guidance — dual-reporting requirement
 */
export function calculateOrganisationTotal(totals: ScopeTotal): OrganisationTotal {
  for (const [key, value] of Object.entries(totals)) {
    if (!Number.isFinite(value) || value < 0) {
      throw new CalculationInputError(
        key,
        `${key} must be a finite non-negative number, got ${value}`
      )
    }
  }

  return {
    ...totals,
    totalLocationBased: totals.scope1 + totals.scope2LocationBased + totals.scope3,
    totalMarketBased: totals.scope1 + totals.scope2MarketBased + totals.scope3,
  }
}

/**
 * Calculates the emissions intensity ratio (tCO2e per £1,000 revenue).
 * Used in annual disclosure reports to track decoupling of growth from emissions.
 * @see GHG Protocol Corporate Standard — Chapter 9 (Reporting Emissions)
 */
export function calculateIntensityRatio(
  totalTCO2e: number,
  revenueGBP: number
): number {
  if (!Number.isFinite(totalTCO2e) || totalTCO2e < 0) {
    throw new CalculationInputError('totalTCO2e', `totalTCO2e must be a finite non-negative number, got ${totalTCO2e}`)
  }
  if (!Number.isFinite(revenueGBP) || revenueGBP <= 0) {
    throw new CalculationInputError('revenueGBP', `revenueGBP must be a positive finite number, got ${revenueGBP}`)
  }
  return (totalTCO2e / revenueGBP) * 1000
}

/**
 * Calculates year-on-year percentage change in total emissions.
 * Returns null if the base year total is zero to avoid division by zero.
 */
export function calculateYearOnYearChange(
  currentTCO2e: number,
  previousTCO2e: number
): number | null {
  if (!Number.isFinite(currentTCO2e) || currentTCO2e < 0) {
    throw new CalculationInputError('currentTCO2e', `currentTCO2e must be a finite non-negative number, got ${currentTCO2e}`)
  }
  if (!Number.isFinite(previousTCO2e) || previousTCO2e < 0) {
    throw new CalculationInputError('previousTCO2e', `previousTCO2e must be a finite non-negative number, got ${previousTCO2e}`)
  }
  if (previousTCO2e === 0) return null
  return ((currentTCO2e - previousTCO2e) / previousTCO2e) * 100
}
