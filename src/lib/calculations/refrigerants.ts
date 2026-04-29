import { CalculationInputError } from '@/lib/errors'

/** GWP threshold above which a refrigerant is flagged as high-impact. */
export const HIGH_GWP_THRESHOLD = 2000

/**
 * Reference GWP values from IPCC AR6 (2021).
 * Use these as defaults when the service engineer record does not specify.
 * @see IPCC Sixth Assessment Report (AR6), WG1, Annex II, Table AII.1.2
 */
export const REFRIGERANT_GWP: Record<string, number> = {
  R404A: 3922,
  R410A: 2088,
  R134a: 1430,
  R407C: 1774,
  R32: 675,
  R290: 3,    // propane
  R600a: 3,   // isobutane
  R744: 1,    // CO2
  R717: 0,    // ammonia
}

/**
 * Refrigerant top-up emissions — Scope 1 F-gas.
 * Formula: topUpMassKg × GWP / 1000 = tCO2e
 * GWP converts mass of refrigerant gas to CO2-equivalent over a 100-year horizon.
 * @see IPCC AR6, WG1, Annex II, Table AII.1.2 (GWP100 values)
 * @see UK F-Gas Regulations — service records required per unit
 */
export function calculateRefrigerantEmissions(
  topUpMassKg: number,
  gwp: number
): number {
  if (!Number.isFinite(topUpMassKg) || topUpMassKg < 0) {
    throw new CalculationInputError(
      'topUpMassKg',
      `topUpMassKg must be a finite non-negative number, got ${topUpMassKg}`
    )
  }
  if (!Number.isInteger(gwp) || gwp < 0) {
    throw new CalculationInputError(
      'gwp',
      `gwp must be a non-negative integer, got ${gwp}`
    )
  }
  return (topUpMassKg * gwp) / 1000
}

/**
 * Returns true if the GWP value exceeds the high-impact threshold (>2000).
 * Used to trigger the high-GWP alert in the data entry UI.
 * R404A (3922) and R410A (2088) commonly trigger this in retail refrigeration.
 */
export function isHighGWP(gwp: number): boolean {
  return gwp > HIGH_GWP_THRESHOLD
}

/**
 * Looks up the GWP for a known refrigerant type.
 * Returns the value from REFRIGERANT_GWP if the type is recognised.
 * Throws if the refrigerant type is unknown — never assume a GWP of zero.
 */
export function lookupGWP(refrigerantType: string): number {
  const normalised = refrigerantType.trim()
  const gwp = REFRIGERANT_GWP[normalised]
  if (gwp === undefined) {
    throw new CalculationInputError(
      'refrigerantType',
      `Unknown refrigerant type "${normalised}". Add the IPCC AR6 GWP value to REFRIGERANT_GWP or enter it manually.`
    )
  }
  return gwp
}
