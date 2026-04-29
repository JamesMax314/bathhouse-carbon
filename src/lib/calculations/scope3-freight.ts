import { CalculationInputError } from '@/lib/errors'

function assertPositive(value: number, field: string): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new CalculationInputError(field, `${field} must be a finite non-negative number, got ${value}`)
  }
}

/**
 * Scope 3 Category 4 — freight emissions using the weight-distance method.
 * Formula: (weightKg / 1000) × distanceKm × kgCO2ePerTonneKm / 1000 = tCO2e
 * Used for road, rail, sea, and air freight where origin/destination distance is known.
 * @see GLEC Framework v3.0 — emissions calculation methodology for logistics
 * @see GHG Protocol Corporate Standard — Scope 3 Category 4 (Upstream Transportation)
 */
export function calculateFreightEmissions(
  weightKg: number,
  distanceKm: number,
  kgCO2ePerTonneKm: number
): number {
  assertPositive(weightKg, 'weightKg')
  assertPositive(distanceKm, 'distanceKm')
  assertPositive(kgCO2ePerTonneKm, 'kgCO2ePerTonneKm')
  const weightTonnes = weightKg / 1000
  return (weightTonnes * distanceKm * kgCO2ePerTonneKm) / 1000
}

/**
 * Scope 3 Category 4 — parcel/courier delivery using a weight-only factor.
 * Used when carrier-specific CO2 data is supplied per kg (e.g. DPD CSV export)
 * rather than tonne-km data.
 * Formula: weightKg × kgCO2ePerKg / 1000 = tCO2e
 * @see GLEC Framework v3.0 — parcel carrier emission intensity
 * @see GHG Protocol Corporate Standard — Scope 3 Category 4
 */
export function calculateParcelDelivery(
  weightKg: number,
  kgCO2ePerKg: number
): number {
  assertPositive(weightKg, 'weightKg')
  assertPositive(kgCO2ePerKg, 'kgCO2ePerKg')
  return (weightKg * kgCO2ePerKg) / 1000
}

export interface FreightShipment {
  description: string
  weightKg: number
  distanceKm: number
  kgCO2ePerTonneKm: number
}

/**
 * Aggregates freight emissions across multiple shipments for a reporting period.
 * @see GLEC Framework v3.0
 */
export function calculateFreightTotal(shipments: FreightShipment[]): number {
  return shipments.reduce(
    (sum, s) => sum + calculateFreightEmissions(s.weightKg, s.distanceKm, s.kgCO2ePerTonneKm),
    0
  )
}
