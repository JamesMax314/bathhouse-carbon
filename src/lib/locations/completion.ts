import { prisma } from '@/lib/prisma'
import type { Location, LocationType } from '@/types'

/**
 * Which emission categories must have at least one entry for a location
 * to be considered complete for that category. Refrigerants use a separate
 * table (RefrigerantEntry) so they are handled specially below.
 */
const APPLICABLE_CATEGORIES: Record<LocationType, string[]> = {
  MANUFACTURING: [
    'SCOPE1_GAS',
    'SCOPE1_VEHICLE_FUEL',
    'SCOPE1_PROCESS_HEAT',
    'SCOPE1_GENERATOR',
    'SCOPE2_ELECTRICITY',
    'SCOPE3_INGREDIENTS',
    'SCOPE3_PACKAGING',
    'SCOPE3_FREIGHT_INBOUND',
    'SCOPE3_WASTE',
  ],
  SHOP: [
    'SCOPE1_GAS',
    'SCOPE1_REFRIGERANT',
    'SCOPE2_ELECTRICITY',
    'SCOPE3_WASTE',
  ],
  ORGANISATION: [
    'SCOPE3_FREIGHT_OUTBOUND',
    'SCOPE3_FREIGHT_INTERSITE',
    'SCOPE3_BUSINESS_TRAVEL',
    'SCOPE3_COMMUTING',
    'SCOPE3_USE_OF_PRODUCTS',
    'SCOPE3_END_OF_LIFE',
  ],
}

function computeCompletionPct(
  locationId: string,
  locationType: LocationType,
  entries: { locationId: string; categoryCode: string }[],
  refrigerantLocationIds: Set<string>,
): number {
  const required = APPLICABLE_CATEGORIES[locationType]
  const covered = required.filter((code) => {
    if (code === 'SCOPE1_REFRIGERANT') {
      return refrigerantLocationIds.has(locationId)
    }
    return entries.some((e) => e.locationId === locationId && e.categoryCode === code)
  })
  return Math.round((covered.length / required.length) * 100)
}

export async function fetchLocationsWithCompletion(): Promise<Location[]> {
  const [dbLocations, period] = await Promise.all([
    prisma.location.findMany({
      where: { isActive: true },
      orderBy: [{ type: 'asc' }, { name: 'asc' }],
    }),
    prisma.reportingPeriod.findFirst({
      where: { status: 'OPEN' },
      orderBy: { startDate: 'desc' },
    }),
  ])

  if (!period) {
    return dbLocations.map((l) => ({
      id: l.id,
      name: l.name,
      region: l.region ?? '',
      type: l.type as LocationType,
      completionPct: 0,
    }))
  }

  const [rawEntries, rawRefrigerants] = await Promise.all([
    prisma.emissionEntry.findMany({
      where: { reportingPeriodId: period.id },
      select: {
        locationId: true,
        category: { select: { code: true } },
      },
    }),
    prisma.refrigerantEntry.findMany({
      where: { reportingPeriodId: period.id },
      select: { locationId: true },
    }),
  ])

  const entries = rawEntries.map((e) => ({
    locationId: e.locationId,
    categoryCode: e.category.code,
  }))
  const refrigerantLocationIds = new Set(rawRefrigerants.map((r) => r.locationId))

  return dbLocations.map((l) => ({
    id: l.id,
    name: l.name,
    region: l.region ?? '',
    type: l.type as LocationType,
    completionPct: computeCompletionPct(
      l.id,
      l.type as LocationType,
      entries,
      refrigerantLocationIds,
    ),
  }))
}
