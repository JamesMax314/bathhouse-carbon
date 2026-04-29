import { CalculationInputError } from '@/lib/errors'

function assertPositive(value: number, field: string): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new CalculationInputError(field, `${field} must be a finite non-negative number, got ${value}`)
  }
}

/**
 * Scope 2 electricity — location-based method.
 * Uses the national grid average emission factor regardless of tariff.
 * Formula: kWh × kgCO2ePerKWh / 1000 = tCO2e
 * @see DEFRA 2024 Greenhouse Gas Reporting: Conversion Factors, Table 3 (UK electricity)
 * @see GHG Protocol Scope 2 Guidance — location-based method
 */
export function calculateElectricityLocationBased(
  kWh: number,
  kgCO2ePerKWh: number
): number {
  assertPositive(kWh, 'kWh')
  assertPositive(kgCO2ePerKWh, 'kgCO2ePerKWh')
  return (kWh * kgCO2ePerKWh) / 1000
}

export interface MarketBasedResult {
  tCO2e: number
  /** True if the supplier's REGO-backed tariff reduced emissions to zero */
  zeroed: boolean
}

/**
 * Scope 2 electricity — market-based method.
 * REGO-backed (100% renewable) tariffs are reported as zero market-based.
 * Non-REGO tariffs use the supplier-specific factor; if unavailable, the
 * residual mix factor should be supplied (never fall back silently to zero).
 * Formula: kWh × kgCO2ePerKWh / 1000 = tCO2e (or 0 if REGO-backed)
 * @see DEFRA 2024 Greenhouse Gas Reporting: Conversion Factors, Table 3
 * @see GHG Protocol Scope 2 Guidance — market-based method
 */
export function calculateElectricityMarketBased(
  kWh: number,
  kgCO2ePerKWh: number,
  isREGOBacked: boolean
): MarketBasedResult {
  assertPositive(kWh, 'kWh')
  if (isREGOBacked) {
    return { tCO2e: 0, zeroed: true }
  }
  assertPositive(kgCO2ePerKWh, 'kgCO2ePerKWh')
  return { tCO2e: (kWh * kgCO2ePerKWh) / 1000, zeroed: false }
}
