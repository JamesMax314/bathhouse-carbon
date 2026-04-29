import { prisma } from '@/lib/prisma'
import { EmissionFactorNotFoundError } from '@/lib/errors'

export interface ResolvedFactor {
  id: string
  factorName: string
  kgCO2ePerUnit: number
  unit: string
  source: string
  effectiveFrom: Date
}

interface ResolveFactorParams {
  /** EmissionCategory.code — e.g. 'SCOPE1_GAS', 'SCOPE2_ELECTRICITY' */
  categoryCode: string
  /**
   * Optional substring match against EmissionFactor.factorName.
   * Use when a category has multiple factors (e.g. diesel vs LPG within
   * SCOPE1_VEHICLE_FUEL). When omitted, returns the single active factor
   * or the most recently effective one if multiple exist.
   */
  factorName?: string
  /** The end date of the reporting period being calculated. */
  periodEndDate: Date
}

/**
 * Returns the versioned emission factor active at the end of the given
 * reporting period. Historical calculations always use the factor that was
 * live during the period, not the current factor.
 *
 * @throws {EmissionFactorNotFoundError} if no matching factor exists — never returns null.
 */
export async function resolveEmissionFactor(
  params: ResolveFactorParams
): Promise<ResolvedFactor> {
  const { categoryCode, factorName, periodEndDate } = params

  const category = await prisma.emissionCategory.findUnique({
    where: { code: categoryCode },
  })

  if (!category) {
    throw new EmissionFactorNotFoundError({ categoryCode, factorName, periodEndDate })
  }

  const factors = await prisma.emissionFactor.findMany({
    where: {
      categoryId: category.id,
      effectiveFrom: { lte: periodEndDate },
      OR: [{ effectiveTo: null }, { effectiveTo: { gt: periodEndDate } }],
      // SQLite LIKE is case-insensitive for ASCII — mode: 'insensitive' not needed
      ...(factorName ? { factorName: { contains: factorName } } : {}),
    },
    orderBy: { effectiveFrom: 'desc' },
  })

  if (factors.length === 0) {
    throw new EmissionFactorNotFoundError({ categoryCode, factorName, periodEndDate })
  }

  const { id, factorName: name, kgCO2ePerUnit, unit, source, effectiveFrom } = factors[0]
  return { id, factorName: name, kgCO2ePerUnit, unit, source, effectiveFrom }
}
