/**
 * Thrown when a calculation receives an invalid or out-of-range input.
 * Contains the field name so callers can surface validation messages.
 */
export class CalculationInputError extends Error {
  readonly field: string

  constructor(field: string, message: string) {
    super(message)
    this.name = 'CalculationInputError'
    this.field = field
  }
}

/**
 * Thrown by the emission factor resolver when no versioned factor can be found
 * for the requested category, optional factor name, and reporting period.
 * Never returns null — always throw this error instead.
 */
export class EmissionFactorNotFoundError extends Error {
  readonly categoryCode: string
  readonly factorName: string | undefined
  readonly periodEndDate: Date | undefined

  constructor(params: {
    categoryCode: string
    factorName?: string
    periodEndDate?: Date
  }) {
    const sub = params.factorName ? ` / "${params.factorName}"` : ''
    const date = params.periodEndDate
      ? ` for period ending ${params.periodEndDate.toISOString().slice(0, 10)}`
      : ''
    super(`No emission factor found for category "${params.categoryCode}"${sub}${date}`)
    this.name = 'EmissionFactorNotFoundError'
    this.categoryCode = params.categoryCode
    this.factorName = params.factorName
    this.periodEndDate = params.periodEndDate
  }
}
