import { CalculationInputError } from '@/lib/errors'

export type TransportMode =
  | 'car-petrol'
  | 'car-diesel'
  | 'car-hybrid'
  | 'car-ev'
  | 'train'
  | 'bus'
  | 'cycle'
  | 'walk'

/**
 * DEFRA 2024 commuting emission factors (kgCO2e per passenger-km).
 * @see DEFRA 2024 Greenhouse Gas Reporting: Conversion Factors, Table 6 (Business travel — passenger vehicles)
 * @see DEFRA 2024 Greenhouse Gas Reporting: Conversion Factors, Table 7 (Business travel — rail)
 */
export const COMMUTING_FACTORS_KG_CO2E_PER_KM: Record<TransportMode, number> = {
  'car-petrol': 0.170,
  'car-diesel': 0.171,
  'car-hybrid': 0.106,
  'car-ev': 0.053,
  train: 0.041,
  bus: 0.089,
  cycle: 0.000,
  walk: 0.000,
}

/** Standard working weeks per year per GHG Protocol commuting guidance. */
export const STANDARD_WORKING_WEEKS = 46

export interface CommuterInput {
  oneWayDistanceKm: number
  transportMode: TransportMode
  daysOnSitePerWeek: number
  /** Defaults to STANDARD_WORKING_WEEKS (46) when omitted. */
  weeksPerYear?: number
}

/**
 * Annual employee commuting emissions.
 * Formula: distance × factor × 2 (return trip) × daysOnSite × weeks / 1000 = tCO2e
 * @see GHG Protocol Corporate Standard — Scope 3 Category 7 (Employee Commuting)
 * @see DEFRA 2024 Greenhouse Gas Reporting: Conversion Factors, Tables 6–7
 */
export function calculateCommuterEmissions(input: CommuterInput): number {
  const { oneWayDistanceKm, transportMode, daysOnSitePerWeek, weeksPerYear = STANDARD_WORKING_WEEKS } = input

  if (!Number.isFinite(oneWayDistanceKm) || oneWayDistanceKm < 0) {
    throw new CalculationInputError(
      'oneWayDistanceKm',
      `oneWayDistanceKm must be a finite non-negative number, got ${oneWayDistanceKm}`
    )
  }
  if (!Number.isFinite(daysOnSitePerWeek) || daysOnSitePerWeek < 0 || daysOnSitePerWeek > 7) {
    throw new CalculationInputError(
      'daysOnSitePerWeek',
      `daysOnSitePerWeek must be between 0 and 7, got ${daysOnSitePerWeek}`
    )
  }
  if (!Number.isFinite(weeksPerYear) || weeksPerYear <= 0 || weeksPerYear > 52) {
    throw new CalculationInputError(
      'weeksPerYear',
      `weeksPerYear must be between 1 and 52, got ${weeksPerYear}`
    )
  }

  const factor = COMMUTING_FACTORS_KG_CO2E_PER_KM[transportMode]
  return (oneWayDistanceKm * factor * 2 * daysOnSitePerWeek * weeksPerYear) / 1000
}

/**
 * Aggregates annual commuting emissions for a group of employees.
 * Returns zero for an empty roster — the caller is responsible for distinguishing
 * "no responses yet" from "all staff walk/cycle".
 */
export function calculateRosterEmissions(
  responses: Array<CommuterInput & { staffName?: string }>
): number {
  return responses.reduce((sum, r) => sum + calculateCommuterEmissions(r), 0)
}
