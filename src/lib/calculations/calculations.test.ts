/**
 * Unit tests for the pure calculation engine.
 *
 * All emission factor values used in assertions are sourced from:
 *   DEFRA 2024 Greenhouse Gas Reporting: Conversion Factors
 *   https://www.gov.uk/government/publications/greenhouse-gas-reporting-conversion-factors-2024
 *
 * Expected tCO2e values are independently verified by hand:
 *   tCO2e = activityValue × factor / 1000
 *
 * IPCC AR6 GWP values sourced from:
 *   IPCC Sixth Assessment Report, WG1, Annex II, Table AII.1.2 (2021)
 */

import { describe, it, expect } from 'vitest'
import { CalculationInputError } from '@/lib/errors'

import { calculateGasCombustion, calculateFuelCombustion, calculateGaseousFuelCombustion } from './scope1'
import { calculateElectricityLocationBased, calculateElectricityMarketBased } from './scope2'
import {
  calculateRefrigerantEmissions,
  isHighGWP,
  lookupGWP,
  HIGH_GWP_THRESHOLD,
  REFRIGERANT_GWP,
} from './refrigerants'
import {
  calculateCommuterEmissions,
  calculateRosterEmissions,
  COMMUTING_FACTORS_KG_CO2E_PER_KM,
  STANDARD_WORKING_WEEKS,
} from './commuting'
import {
  calculateIngredientEmissions,
  calculateBatchIngredients,
  calculatePackagingEmissions,
} from './scope3-ingredients'
import {
  calculateFreightEmissions,
  calculateParcelDelivery,
  calculateFreightTotal,
} from './scope3-freight'
import {
  calculateWasteEmissions,
  calculateWasteStreams,
  calculateWastewaterEmissions,
} from './scope3-waste'
import {
  sumEntries,
  calculateOrganisationTotal,
  calculateIntensityRatio,
  calculateYearOnYearChange,
} from './totals'

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Round to 6 decimal places to avoid floating-point noise in assertions. */
function round(n: number, dp = 6): number {
  return Math.round(n * 10 ** dp) / 10 ** dp
}

// ─── Scope 1 — calculateGasCombustion ────────────────────────────────────────

describe('calculateGasCombustion', () => {
  // DEFRA 2024 natural gas factor: 0.18293 kgCO2e/kWh (gross calorific value)
  const GAS_FACTOR = 0.18293

  it('calculates correctly for typical monthly gas consumption', () => {
    // 5,000 kWh × 0.18293 kgCO2e/kWh / 1000 = 0.91465 tCO2e
    expect(round(calculateGasCombustion(5000, GAS_FACTOR))).toBe(round(5000 * GAS_FACTOR / 1000))
  })

  it('returns zero when consumption is zero', () => {
    expect(calculateGasCombustion(0, GAS_FACTOR)).toBe(0)
  })

  it('returns zero when factor is zero (edge case — zero-emission synthetic gas)', () => {
    expect(calculateGasCombustion(1000, 0)).toBe(0)
  })

  it('throws CalculationInputError for negative consumption', () => {
    expect(() => calculateGasCombustion(-1, GAS_FACTOR)).toThrow(CalculationInputError)
  })

  it('throws CalculationInputError for NaN consumption', () => {
    expect(() => calculateGasCombustion(NaN, GAS_FACTOR)).toThrow(CalculationInputError)
  })

  it('throws CalculationInputError for negative factor', () => {
    expect(() => calculateGasCombustion(1000, -0.1)).toThrow(CalculationInputError)
  })

  it('throws CalculationInputError for Infinity', () => {
    expect(() => calculateGasCombustion(Infinity, GAS_FACTOR)).toThrow(CalculationInputError)
  })
})

// ─── Scope 1 — calculateFuelCombustion ───────────────────────────────────────

describe('calculateFuelCombustion', () => {
  // DEFRA 2024 diesel (average biofuel blend) factor: 2.51251 kgCO2e/litre
  const DIESEL_FACTOR = 2.51251

  it('calculates correctly for diesel vehicle fuel', () => {
    // 200 litres × 2.51251 / 1000 = 0.502502 tCO2e
    expect(round(calculateFuelCombustion(200, DIESEL_FACTOR))).toBe(round(200 * DIESEL_FACTOR / 1000))
  })

  // DEFRA 2024 petrol (average biofuel blend) factor: 2.16138 kgCO2e/litre
  it('calculates correctly for petrol', () => {
    const PETROL_FACTOR = 2.16138
    expect(round(calculateFuelCombustion(150, PETROL_FACTOR))).toBe(round(150 * PETROL_FACTOR / 1000))
  })

  it('returns zero for zero litres', () => {
    expect(calculateFuelCombustion(0, DIESEL_FACTOR)).toBe(0)
  })

  it('throws CalculationInputError for negative litres', () => {
    expect(() => calculateFuelCombustion(-10, DIESEL_FACTOR)).toThrow(CalculationInputError)
  })

  it('throws CalculationInputError for NaN factor', () => {
    expect(() => calculateFuelCombustion(100, NaN)).toThrow(CalculationInputError)
  })
})

// ─── Scope 1 — calculateGaseousFuelCombustion ────────────────────────────────

describe('calculateGaseousFuelCombustion', () => {
  // DEFRA 2024 LPG factor: 1.55462 kgCO2e/kg
  const LPG_FACTOR = 1.55462

  it('calculates correctly for LPG by weight', () => {
    // 100 kg × 1.55462 / 1000 = 0.155462 tCO2e
    expect(round(calculateGaseousFuelCombustion(100, LPG_FACTOR))).toBe(round(100 * LPG_FACTOR / 1000))
  })

  it('returns zero for zero kg', () => {
    expect(calculateGaseousFuelCombustion(0, LPG_FACTOR)).toBe(0)
  })

  it('throws CalculationInputError for negative kg', () => {
    expect(() => calculateGaseousFuelCombustion(-5, LPG_FACTOR)).toThrow(CalculationInputError)
  })
})

// ─── Scope 2 — calculateElectricityLocationBased ─────────────────────────────

describe('calculateElectricityLocationBased', () => {
  // DEFRA 2024 UK grid electricity location-based factor: 0.20707 kgCO2e/kWh
  const GRID_FACTOR = 0.20707

  it('calculates correctly for typical shop monthly electricity', () => {
    // 2,500 kWh × 0.20707 / 1000 = 0.517675 tCO2e
    expect(round(calculateElectricityLocationBased(2500, GRID_FACTOR))).toBe(round(2500 * GRID_FACTOR / 1000))
  })

  it('calculates correctly for manufacturing annual electricity', () => {
    // 120,000 kWh × 0.20707 / 1000 = 24.8484 tCO2e
    expect(round(calculateElectricityLocationBased(120000, GRID_FACTOR))).toBe(round(120000 * GRID_FACTOR / 1000))
  })

  it('returns zero for zero consumption', () => {
    expect(calculateElectricityLocationBased(0, GRID_FACTOR)).toBe(0)
  })

  it('throws CalculationInputError for negative kWh', () => {
    expect(() => calculateElectricityLocationBased(-100, GRID_FACTOR)).toThrow(CalculationInputError)
  })

  it('throws CalculationInputError for negative factor', () => {
    expect(() => calculateElectricityLocationBased(1000, -0.2)).toThrow(CalculationInputError)
  })
})

// ─── Scope 2 — calculateElectricityMarketBased ───────────────────────────────

describe('calculateElectricityMarketBased', () => {
  const GRID_FACTOR = 0.20707

  it('returns zero tCO2e with zeroed=true for a REGO-backed tariff', () => {
    const result = calculateElectricityMarketBased(10000, GRID_FACTOR, true)
    expect(result.tCO2e).toBe(0)
    expect(result.zeroed).toBe(true)
  })

  it('calculates normally for a non-REGO tariff', () => {
    const result = calculateElectricityMarketBased(2500, GRID_FACTOR, false)
    expect(round(result.tCO2e)).toBe(round(2500 * GRID_FACTOR / 1000))
    expect(result.zeroed).toBe(false)
  })

  it('returns zero tCO2e for zero consumption even without REGO', () => {
    const result = calculateElectricityMarketBased(0, GRID_FACTOR, false)
    expect(result.tCO2e).toBe(0)
    expect(result.zeroed).toBe(false)
  })

  it('throws CalculationInputError for negative kWh', () => {
    expect(() => calculateElectricityMarketBased(-100, GRID_FACTOR, false)).toThrow(CalculationInputError)
  })

  it('does not validate factor when REGO-backed (factor is irrelevant)', () => {
    // REGO path short-circuits before factor is used — should not throw
    expect(() => calculateElectricityMarketBased(1000, -99, true)).not.toThrow()
  })

  it('throws CalculationInputError for negative factor when not REGO-backed', () => {
    expect(() => calculateElectricityMarketBased(1000, -0.1, false)).toThrow(CalculationInputError)
  })
})

// ─── Refrigerants — calculateRefrigerantEmissions ────────────────────────────

describe('calculateRefrigerantEmissions', () => {
  it('calculates correctly for R404A (high-GWP commercial refrigerant)', () => {
    // R404A GWP = 3922 (IPCC AR6)
    // 2 kg × 3922 / 1000 = 7.844 tCO2e
    expect(round(calculateRefrigerantEmissions(2, 3922))).toBe(round(2 * 3922 / 1000))
  })

  it('calculates correctly for R290 propane (low-GWP alternative)', () => {
    // R290 GWP = 3 (IPCC AR6)
    // 2 kg × 3 / 1000 = 0.006 tCO2e
    expect(round(calculateRefrigerantEmissions(2, 3))).toBe(round(2 * 3 / 1000))
  })

  it('returns zero for zero top-up mass', () => {
    expect(calculateRefrigerantEmissions(0, 3922)).toBe(0)
  })

  it('returns zero for a refrigerant with GWP of zero', () => {
    expect(calculateRefrigerantEmissions(5, 0)).toBe(0)
  })

  it('throws CalculationInputError for negative top-up mass', () => {
    expect(() => calculateRefrigerantEmissions(-1, 3922)).toThrow(CalculationInputError)
  })

  it('throws CalculationInputError for NaN mass', () => {
    expect(() => calculateRefrigerantEmissions(NaN, 3922)).toThrow(CalculationInputError)
  })

  it('throws CalculationInputError for a non-integer GWP', () => {
    expect(() => calculateRefrigerantEmissions(1, 1.5)).toThrow(CalculationInputError)
  })

  it('throws CalculationInputError for a negative GWP', () => {
    expect(() => calculateRefrigerantEmissions(1, -100)).toThrow(CalculationInputError)
  })
})

// ─── Refrigerants — isHighGWP ────────────────────────────────────────────────

describe('isHighGWP', () => {
  it(`returns true for R404A GWP ${REFRIGERANT_GWP.R404A} (above threshold ${HIGH_GWP_THRESHOLD})`, () => {
    expect(isHighGWP(REFRIGERANT_GWP.R404A)).toBe(true)
  })

  it(`returns true for R410A GWP ${REFRIGERANT_GWP.R410A} (above threshold)`, () => {
    expect(isHighGWP(REFRIGERANT_GWP.R410A)).toBe(true)
  })

  it(`returns false for R290 GWP ${REFRIGERANT_GWP.R290} (below threshold)`, () => {
    expect(isHighGWP(REFRIGERANT_GWP.R290)).toBe(false)
  })

  it(`returns false for exactly ${HIGH_GWP_THRESHOLD} (threshold is exclusive)`, () => {
    expect(isHighGWP(HIGH_GWP_THRESHOLD)).toBe(false)
  })

  it(`returns true for ${HIGH_GWP_THRESHOLD + 1}`, () => {
    expect(isHighGWP(HIGH_GWP_THRESHOLD + 1)).toBe(true)
  })
})

// ─── Refrigerants — lookupGWP ────────────────────────────────────────────────

describe('lookupGWP', () => {
  it('returns the correct GWP for R404A', () => {
    expect(lookupGWP('R404A')).toBe(3922)
  })

  it('returns the correct GWP for R290 (propane)', () => {
    expect(lookupGWP('R290')).toBe(3)
  })

  it('trims whitespace from the refrigerant type', () => {
    expect(lookupGWP('  R134a  ')).toBe(1430)
  })

  it('throws CalculationInputError for an unrecognised refrigerant', () => {
    expect(() => lookupGWP('R999X')).toThrow(CalculationInputError)
  })

  it('throws CalculationInputError for an empty string', () => {
    expect(() => lookupGWP('')).toThrow(CalculationInputError)
  })
})

// ─── Commuting — calculateCommuterEmissions ───────────────────────────────────

describe('calculateCommuterEmissions', () => {
  // DEFRA 2024 car petrol factor: 0.170 kgCO2e/km
  // Formula: distance × factor × 2 × daysOnSite × 46 weeks / 1000

  it('calculates correctly for a car-petrol commuter (5 days/wk, 10 km)', () => {
    // 10 × 0.170 × 2 × 5 × 46 / 1000 = 0.782 tCO2e
    const expected = 10 * COMMUTING_FACTORS_KG_CO2E_PER_KM['car-petrol'] * 2 * 5 * 46 / 1000
    expect(round(calculateCommuterEmissions({
      oneWayDistanceKm: 10,
      transportMode: 'car-petrol',
      daysOnSitePerWeek: 5,
    }))).toBe(round(expected))
  })

  it('calculates correctly for a train commuter (3 days/wk, 25 km)', () => {
    // 25 × 0.041 × 2 × 3 × 46 / 1000 = 0.2829 tCO2e
    const expected = 25 * COMMUTING_FACTORS_KG_CO2E_PER_KM['train'] * 2 * 3 * 46 / 1000
    expect(round(calculateCommuterEmissions({
      oneWayDistanceKm: 25,
      transportMode: 'train',
      daysOnSitePerWeek: 3,
    }))).toBe(round(expected))
  })

  it('returns zero for a cyclist regardless of distance', () => {
    expect(calculateCommuterEmissions({
      oneWayDistanceKm: 15,
      transportMode: 'cycle',
      daysOnSitePerWeek: 5,
    })).toBe(0)
  })

  it('returns zero for a walker', () => {
    expect(calculateCommuterEmissions({
      oneWayDistanceKm: 2,
      transportMode: 'walk',
      daysOnSitePerWeek: 5,
    })).toBe(0)
  })

  it('uses STANDARD_WORKING_WEEKS (46) by default', () => {
    const withDefault = calculateCommuterEmissions({
      oneWayDistanceKm: 10,
      transportMode: 'car-diesel',
      daysOnSitePerWeek: 5,
    })
    const withExplicit = calculateCommuterEmissions({
      oneWayDistanceKm: 10,
      transportMode: 'car-diesel',
      daysOnSitePerWeek: 5,
      weeksPerYear: STANDARD_WORKING_WEEKS,
    })
    expect(withDefault).toBe(withExplicit)
  })

  it('accepts a custom weeksPerYear override', () => {
    const result = calculateCommuterEmissions({
      oneWayDistanceKm: 10,
      transportMode: 'car-petrol',
      daysOnSitePerWeek: 5,
      weeksPerYear: 40,
    })
    const expected = 10 * COMMUTING_FACTORS_KG_CO2E_PER_KM['car-petrol'] * 2 * 5 * 40 / 1000
    expect(round(result)).toBe(round(expected))
  })

  it('returns zero when daysOnSitePerWeek is zero (fully remote)', () => {
    expect(calculateCommuterEmissions({
      oneWayDistanceKm: 20,
      transportMode: 'car-petrol',
      daysOnSitePerWeek: 0,
    })).toBe(0)
  })

  it('returns zero when distance is zero', () => {
    expect(calculateCommuterEmissions({
      oneWayDistanceKm: 0,
      transportMode: 'car-petrol',
      daysOnSitePerWeek: 5,
    })).toBe(0)
  })

  it('throws CalculationInputError for negative distance', () => {
    expect(() => calculateCommuterEmissions({
      oneWayDistanceKm: -5,
      transportMode: 'car-petrol',
      daysOnSitePerWeek: 5,
    })).toThrow(CalculationInputError)
  })

  it('throws CalculationInputError for daysOnSitePerWeek > 7', () => {
    expect(() => calculateCommuterEmissions({
      oneWayDistanceKm: 10,
      transportMode: 'car-petrol',
      daysOnSitePerWeek: 8,
    })).toThrow(CalculationInputError)
  })

  it('throws CalculationInputError for weeksPerYear > 52', () => {
    expect(() => calculateCommuterEmissions({
      oneWayDistanceKm: 10,
      transportMode: 'car-petrol',
      daysOnSitePerWeek: 5,
      weeksPerYear: 53,
    })).toThrow(CalculationInputError)
  })

  it('throws CalculationInputError for NaN distance', () => {
    expect(() => calculateCommuterEmissions({
      oneWayDistanceKm: NaN,
      transportMode: 'bus',
      daysOnSitePerWeek: 5,
    })).toThrow(CalculationInputError)
  })
})

// ─── Commuting — calculateRosterEmissions ────────────────────────────────────

describe('calculateRosterEmissions', () => {
  it('sums emissions correctly across a mixed-mode roster', () => {
    const roster = [
      { oneWayDistanceKm: 10, transportMode: 'car-petrol' as const, daysOnSitePerWeek: 5 },
      { oneWayDistanceKm: 20, transportMode: 'train' as const, daysOnSitePerWeek: 3 },
      { oneWayDistanceKm: 5, transportMode: 'cycle' as const, daysOnSitePerWeek: 5 },
    ]
    const expected = roster.reduce(
      (sum, r) => sum + calculateCommuterEmissions(r),
      0
    )
    expect(round(calculateRosterEmissions(roster))).toBe(round(expected))
  })

  it('returns zero for an empty roster', () => {
    expect(calculateRosterEmissions([])).toBe(0)
  })

  it('returns zero for a roster where all staff cycle or walk', () => {
    const roster = [
      { oneWayDistanceKm: 3, transportMode: 'cycle' as const, daysOnSitePerWeek: 5 },
      { oneWayDistanceKm: 1, transportMode: 'walk' as const, daysOnSitePerWeek: 5 },
    ]
    expect(calculateRosterEmissions(roster)).toBe(0)
  })
})

// ─── Scope 3 Ingredients — calculateIngredientEmissions ──────────────────────

describe('calculateIngredientEmissions', () => {
  // Ecoinvent v3 approximate factor for Rosa canina fruit extract: ~3.2 kgCO2e/kg
  const ROSA_FACTOR = 3.2

  it('calculates correctly for a typical ingredient weight', () => {
    // 0.5 kg × 3.2 / 1000 = 0.0016 tCO2e
    expect(round(calculateIngredientEmissions(0.5, ROSA_FACTOR))).toBe(round(0.5 * ROSA_FACTOR / 1000))
  })

  it('returns zero for a zero-weight ingredient', () => {
    expect(calculateIngredientEmissions(0, ROSA_FACTOR)).toBe(0)
  })

  it('returns zero for a zero-emission factor ingredient (e.g. water)', () => {
    expect(calculateIngredientEmissions(10, 0)).toBe(0)
  })

  it('throws CalculationInputError for negative weight', () => {
    expect(() => calculateIngredientEmissions(-1, ROSA_FACTOR)).toThrow(CalculationInputError)
  })

  it('throws CalculationInputError for negative factor', () => {
    expect(() => calculateIngredientEmissions(1, -1)).toThrow(CalculationInputError)
  })
})

// ─── Scope 3 Ingredients — calculateBatchIngredients ─────────────────────────

describe('calculateBatchIngredients', () => {
  it('sums mapped ingredients and excludes unmapped ones', () => {
    const ingredients = [
      { inciName: 'Aqua', weightKg: 5, kgCO2ePerKg: 0.0003 },
      { inciName: 'Rosa Canina Fruit Extract', weightKg: 0.5, kgCO2ePerKg: 3.2 },
      { inciName: 'New Unmapped Ingredient', weightKg: 0.2, kgCO2ePerKg: null },
    ]
    const result = calculateBatchIngredients(ingredients)

    const expectedTCO2e = (5 * 0.0003 + 0.5 * 3.2) / 1000
    expect(round(result.tCO2e)).toBe(round(expectedTCO2e))
    expect(result.unmappedIngredients).toEqual(['New Unmapped Ingredient'])
  })

  it('returns tCO2e=0 and empty unmappedIngredients for an empty batch', () => {
    const result = calculateBatchIngredients([])
    expect(result.tCO2e).toBe(0)
    expect(result.unmappedIngredients).toHaveLength(0)
  })

  it('returns all ingredients as unmapped when none have a factor', () => {
    const ingredients = [
      { inciName: 'Unknown A', weightKg: 1, kgCO2ePerKg: null },
      { inciName: 'Unknown B', weightKg: 2, kgCO2ePerKg: null },
    ]
    const result = calculateBatchIngredients(ingredients)
    expect(result.tCO2e).toBe(0)
    expect(result.unmappedIngredients).toHaveLength(2)
  })
})

// ─── Scope 3 Ingredients — calculatePackagingEmissions ───────────────────────

describe('calculatePackagingEmissions', () => {
  // DEFRA 2024 Table 10 (Material use) — glass: ~0.87 kgCO2e/kg
  const GLASS_FACTOR = 0.87

  it('calculates correctly for glass packaging', () => {
    // 2 kg × 0.87 / 1000 = 0.00174 tCO2e
    expect(round(calculatePackagingEmissions(2, GLASS_FACTOR))).toBe(round(2 * GLASS_FACTOR / 1000))
  })

  it('returns zero for zero weight', () => {
    expect(calculatePackagingEmissions(0, GLASS_FACTOR)).toBe(0)
  })

  it('throws CalculationInputError for negative weight', () => {
    expect(() => calculatePackagingEmissions(-1, GLASS_FACTOR)).toThrow(CalculationInputError)
  })

  it('throws CalculationInputError for negative factor', () => {
    expect(() => calculatePackagingEmissions(1, -0.5)).toThrow(CalculationInputError)
  })
})

// ─── Scope 3 Freight — calculateFreightEmissions ─────────────────────────────

describe('calculateFreightEmissions', () => {
  // GLEC Framework v3.0 — road freight (articulated HGV, average load): ~0.062 kgCO2e/tonne-km
  const ROAD_FREIGHT_FACTOR = 0.062

  it('calculates correctly for a road freight shipment', () => {
    // 500 kg = 0.5 t, 200 km, 0.062 kgCO2e/t-km
    // 0.5 × 200 × 0.062 / 1000 = 0.0062 tCO2e
    expect(round(calculateFreightEmissions(500, 200, ROAD_FREIGHT_FACTOR))).toBe(
      round((500 / 1000) * 200 * ROAD_FREIGHT_FACTOR / 1000)
    )
  })

  it('returns zero for zero weight', () => {
    expect(calculateFreightEmissions(0, 200, ROAD_FREIGHT_FACTOR)).toBe(0)
  })

  it('returns zero for zero distance', () => {
    expect(calculateFreightEmissions(500, 0, ROAD_FREIGHT_FACTOR)).toBe(0)
  })

  it('throws CalculationInputError for negative weight', () => {
    expect(() => calculateFreightEmissions(-100, 200, ROAD_FREIGHT_FACTOR)).toThrow(CalculationInputError)
  })

  it('throws CalculationInputError for negative distance', () => {
    expect(() => calculateFreightEmissions(100, -50, ROAD_FREIGHT_FACTOR)).toThrow(CalculationInputError)
  })

  it('throws CalculationInputError for negative factor', () => {
    expect(() => calculateFreightEmissions(100, 200, -0.06)).toThrow(CalculationInputError)
  })
})

// ─── Scope 3 Freight — calculateParcelDelivery ───────────────────────────────

describe('calculateParcelDelivery', () => {
  // DEFRA 2024 courier delivery factor (road): ~0.00038 kgCO2e/kg (representative value)
  const COURIER_FACTOR = 0.00038

  it('calculates correctly for a batch of customer parcels', () => {
    // 1000 kg × 0.00038 / 1000 = 0.00038 tCO2e
    expect(round(calculateParcelDelivery(1000, COURIER_FACTOR))).toBe(
      round(1000 * COURIER_FACTOR / 1000)
    )
  })

  it('returns zero for zero weight', () => {
    expect(calculateParcelDelivery(0, COURIER_FACTOR)).toBe(0)
  })

  it('throws CalculationInputError for negative weight', () => {
    expect(() => calculateParcelDelivery(-50, COURIER_FACTOR)).toThrow(CalculationInputError)
  })

  it('throws CalculationInputError for negative factor', () => {
    expect(() => calculateParcelDelivery(100, -0.001)).toThrow(CalculationInputError)
  })
})

// ─── Scope 3 Freight — calculateFreightTotal ─────────────────────────────────

describe('calculateFreightTotal', () => {
  const ROAD_FACTOR = 0.062

  it('sums multiple shipments correctly', () => {
    const shipments = [
      { description: 'DPD delivery run A', weightKg: 500, distanceKm: 200, kgCO2ePerTonneKm: ROAD_FACTOR },
      { description: 'Inbound raw materials', weightKg: 1200, distanceKm: 350, kgCO2ePerTonneKm: ROAD_FACTOR },
    ]
    const expected = shipments.reduce(
      (sum, s) => sum + calculateFreightEmissions(s.weightKg, s.distanceKm, s.kgCO2ePerTonneKm),
      0
    )
    expect(round(calculateFreightTotal(shipments))).toBe(round(expected))
  })

  it('returns zero for an empty shipment list', () => {
    expect(calculateFreightTotal([])).toBe(0)
  })
})

// ─── Scope 3 Waste — calculateWasteEmissions ─────────────────────────────────

describe('calculateWasteEmissions', () => {
  // DEFRA 2024 waste to landfill (mixed waste): 0.44369 kgCO2e/kg
  const LANDFILL_FACTOR = 0.44369

  it('calculates correctly for landfill disposal', () => {
    // 50 kg × 0.44369 / 1000 = 0.0221845 tCO2e
    expect(round(calculateWasteEmissions(50, LANDFILL_FACTOR))).toBe(
      round(50 * LANDFILL_FACTOR / 1000)
    )
  })

  it('returns zero for zero waste weight', () => {
    expect(calculateWasteEmissions(0, LANDFILL_FACTOR)).toBe(0)
  })

  it('returns zero for a zero-emission disposal route (e.g. recycling with zero factor)', () => {
    expect(calculateWasteEmissions(100, 0)).toBe(0)
  })

  it('throws CalculationInputError for negative weight', () => {
    expect(() => calculateWasteEmissions(-10, LANDFILL_FACTOR)).toThrow(CalculationInputError)
  })

  it('throws CalculationInputError for negative factor', () => {
    expect(() => calculateWasteEmissions(10, -0.1)).toThrow(CalculationInputError)
  })
})

// ─── Scope 3 Waste — calculateWasteStreams ────────────────────────────────────

describe('calculateWasteStreams', () => {
  it('sums multiple waste streams correctly', () => {
    const streams = [
      // DEFRA 2024 — waste to landfill: 0.44369 kgCO2e/kg
      { streamName: 'General waste to landfill', weightKg: 50, kgCO2ePerKg: 0.44369 },
      // DEFRA 2024 — paper/card recycling: ~0.02110 kgCO2e/kg
      { streamName: 'Cardboard recycling', weightKg: 30, kgCO2ePerKg: 0.02110 },
    ]
    const expected = streams.reduce((sum, s) => sum + (s.weightKg * s.kgCO2ePerKg) / 1000, 0)
    expect(round(calculateWasteStreams(streams))).toBe(round(expected))
  })

  it('returns zero for an empty stream list', () => {
    expect(calculateWasteStreams([])).toBe(0)
  })
})

// ─── Scope 3 Waste — calculateWastewaterEmissions ────────────────────────────

describe('calculateWastewaterEmissions', () => {
  // DEFRA 2024 wastewater treatment factor: 0.708 kgCO2e/m³ (indicative)
  const WASTEWATER_FACTOR = 0.708

  it('calculates correctly for trade effluent discharge', () => {
    // 200 m³ × 0.708 / 1000 = 0.1416 tCO2e
    expect(round(calculateWastewaterEmissions(200, WASTEWATER_FACTOR))).toBe(
      round(200 * WASTEWATER_FACTOR / 1000)
    )
  })

  it('returns zero for zero volume', () => {
    expect(calculateWastewaterEmissions(0, WASTEWATER_FACTOR)).toBe(0)
  })

  it('throws CalculationInputError for negative volume', () => {
    expect(() => calculateWastewaterEmissions(-10, WASTEWATER_FACTOR)).toThrow(CalculationInputError)
  })
})

// ─── Totals — sumEntries ──────────────────────────────────────────────────────

describe('sumEntries', () => {
  it('sums tCO2e values from a list of entries', () => {
    const entries = [
      { tCO2e: 1.5 },
      { tCO2e: 0.75 },
      { tCO2e: 2.0 },
    ]
    expect(sumEntries(entries)).toBe(4.25)
  })

  it('returns zero for an empty list', () => {
    expect(sumEntries([])).toBe(0)
  })

  it('throws CalculationInputError for an entry containing NaN', () => {
    expect(() => sumEntries([{ tCO2e: 1.0 }, { tCO2e: NaN }])).toThrow(CalculationInputError)
  })

  it('throws CalculationInputError for an entry containing Infinity', () => {
    expect(() => sumEntries([{ tCO2e: Infinity }])).toThrow(CalculationInputError)
  })
})

// ─── Totals — calculateOrganisationTotal ─────────────────────────────────────

describe('calculateOrganisationTotal', () => {
  const input = {
    scope1: 10.5,
    scope2LocationBased: 8.2,
    scope2MarketBased: 0,    // REGO-backed
    scope3: 45.3,
  }

  it('calculates location-based total correctly', () => {
    const result = calculateOrganisationTotal(input)
    expect(round(result.totalLocationBased)).toBe(round(10.5 + 8.2 + 45.3))
  })

  it('calculates market-based total correctly (with zero Scope 2)', () => {
    const result = calculateOrganisationTotal(input)
    expect(round(result.totalMarketBased)).toBe(round(10.5 + 0 + 45.3))
  })

  it('passes through individual scope totals unchanged', () => {
    const result = calculateOrganisationTotal(input)
    expect(result.scope1).toBe(10.5)
    expect(result.scope3).toBe(45.3)
  })

  it('throws CalculationInputError for a negative scope value', () => {
    expect(() => calculateOrganisationTotal({ ...input, scope1: -1 })).toThrow(CalculationInputError)
  })

  it('throws CalculationInputError for NaN in any scope', () => {
    expect(() => calculateOrganisationTotal({ ...input, scope3: NaN })).toThrow(CalculationInputError)
  })
})

// ─── Totals — calculateIntensityRatio ────────────────────────────────────────

describe('calculateIntensityRatio', () => {
  it('calculates tCO2e per £1,000 revenue correctly', () => {
    // 64 tCO2e, £2,000,000 revenue → 64 / 2,000,000 × 1000 = 0.032 tCO2e/£k
    expect(round(calculateIntensityRatio(64, 2_000_000))).toBe(round(64 / 2_000_000 * 1000))
  })

  it('throws CalculationInputError for zero revenue (division by zero)', () => {
    expect(() => calculateIntensityRatio(64, 0)).toThrow(CalculationInputError)
  })

  it('throws CalculationInputError for negative emissions', () => {
    expect(() => calculateIntensityRatio(-1, 1_000_000)).toThrow(CalculationInputError)
  })

  it('throws CalculationInputError for negative revenue', () => {
    expect(() => calculateIntensityRatio(64, -500_000)).toThrow(CalculationInputError)
  })
})

// ─── Totals — calculateYearOnYearChange ──────────────────────────────────────

describe('calculateYearOnYearChange', () => {
  it('calculates a reduction correctly', () => {
    // 48 tCO2e down from 60 → −20%
    expect(round(calculateYearOnYearChange(48, 60))).toBe(round((48 - 60) / 60 * 100))
  })

  it('calculates an increase correctly', () => {
    // 72 tCO2e up from 60 → +20%
    expect(round(calculateYearOnYearChange(72, 60))).toBe(round((72 - 60) / 60 * 100))
  })

  it('returns null when the previous year total is zero (base year edge case)', () => {
    expect(calculateYearOnYearChange(10, 0)).toBeNull()
  })

  it('returns zero for identical years', () => {
    expect(calculateYearOnYearChange(60, 60)).toBe(0)
  })

  it('throws CalculationInputError for negative current emissions', () => {
    expect(() => calculateYearOnYearChange(-1, 60)).toThrow(CalculationInputError)
  })

  it('throws CalculationInputError for NaN previous emissions', () => {
    expect(() => calculateYearOnYearChange(60, NaN)).toThrow(CalculationInputError)
  })
})
