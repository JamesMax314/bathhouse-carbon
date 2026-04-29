import { CalculationInputError } from '@/lib/errors'

function assertPositive(value: number, field: string): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new CalculationInputError(field, `${field} must be a finite non-negative number, got ${value}`)
  }
}

/**
 * Scope 3 Category 5 — waste disposal emissions for a single waste stream.
 * Formula: weightKg × kgCO2ePerKg / 1000 = tCO2e
 * Different waste treatment routes (landfill, recycling, composting, incineration)
 * have distinct DEFRA factors — always use the route-specific factor.
 * @see DEFRA 2024 Greenhouse Gas Reporting: Conversion Factors, Table 9 (Waste disposal)
 * @see GHG Protocol Corporate Standard — Scope 3 Category 5 (Waste Generated in Operations)
 */
export function calculateWasteEmissions(
  weightKg: number,
  kgCO2ePerKg: number
): number {
  assertPositive(weightKg, 'weightKg')
  assertPositive(kgCO2ePerKg, 'kgCO2ePerKg')
  return (weightKg * kgCO2ePerKg) / 1000
}

export interface WasteStream {
  streamName: string
  weightKg: number
  /** Factor for this specific disposal route from DEFRA 2024 Table 9. */
  kgCO2ePerKg: number
}

/**
 * Aggregates waste emissions across multiple disposal routes for a location.
 * Handles mixed waste disposal — general, recycling, production waste, hazardous.
 * @see DEFRA 2024 Greenhouse Gas Reporting: Conversion Factors, Table 9
 */
export function calculateWasteStreams(streams: WasteStream[]): number {
  return streams.reduce(
    (sum, s) => sum + calculateWasteEmissions(s.weightKg, s.kgCO2ePerKg),
    0
  )
}

/**
 * Wastewater / trade effluent emissions.
 * Formula: volumeM3 × kgCO2ePerM3 / 1000 = tCO2e
 * Manufacturing only — not applicable to shops.
 * @see DEFRA 2024 Greenhouse Gas Reporting: Conversion Factors, Table 9 (Water supply and treatment)
 */
export function calculateWastewaterEmissions(
  volumeM3: number,
  kgCO2ePerM3: number
): number {
  assertPositive(volumeM3, 'volumeM3')
  assertPositive(kgCO2ePerM3, 'kgCO2ePerM3')
  return (volumeM3 * kgCO2ePerM3) / 1000
}
