import { CalculationInputError } from '@/lib/errors'

function assertPositive(value: number, field: string): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new CalculationInputError(field, `${field} must be a finite non-negative number, got ${value}`)
  }
}

/**
 * Natural gas combustion — Scope 1.
 * Formula: kWh × kgCO2ePerKWh / 1000 = tCO2e
 * @see DEFRA 2024 Greenhouse Gas Reporting: Conversion Factors, Table 1a (Fuels)
 */
export function calculateGasCombustion(kWh: number, kgCO2ePerKWh: number): number {
  assertPositive(kWh, 'kWh')
  assertPositive(kgCO2ePerKWh, 'kgCO2ePerKWh')
  return (kWh * kgCO2ePerKWh) / 1000
}

/**
 * Liquid fuel combustion (vehicles, plant, process heat, generators).
 * Formula: litres × kgCO2ePerLitre / 1000 = tCO2e
 * @see DEFRA 2024 Greenhouse Gas Reporting: Conversion Factors, Table 1a (Fuels)
 */
export function calculateFuelCombustion(litres: number, kgCO2ePerLitre: number): number {
  assertPositive(litres, 'litres')
  assertPositive(kgCO2ePerLitre, 'kgCO2ePerLitre')
  return (litres * kgCO2ePerLitre) / 1000
}

/**
 * Gaseous fuel combustion (LPG) by weight.
 * Formula: kg × kgCO2ePerKg / 1000 = tCO2e
 * @see DEFRA 2024 Greenhouse Gas Reporting: Conversion Factors, Table 1a (Fuels)
 */
export function calculateGaseousFuelCombustion(kg: number, kgCO2ePerKg: number): number {
  assertPositive(kg, 'kg')
  assertPositive(kgCO2ePerKg, 'kgCO2ePerKg')
  return (kg * kgCO2ePerKg) / 1000
}
