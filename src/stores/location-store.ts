'use client'

import { create } from 'zustand'
import { SEED_LOCATIONS } from '@/lib/data/locations'
import type { Location, ReportingPeriod } from '@/types'

const DEFAULT_PERIOD: ReportingPeriod = {
  id: 'period-2024',
  label: 'FY 2024',
  startDate: '2024-01-01',
  endDate: '2024-12-31',
  status: 'OPEN',
}

interface LocationStore {
  locations: Location[]
  selectedLocationId: string
  reportingPeriod: ReportingPeriod
  selectedLocation: () => Location | undefined
  setSelectedLocationId: (id: string) => void
  setReportingPeriod: (period: ReportingPeriod) => void
}

export const useLocationStore = create<LocationStore>((set, get) => ({
  locations: SEED_LOCATIONS,
  selectedLocationId: SEED_LOCATIONS[0].id,
  reportingPeriod: DEFAULT_PERIOD,
  selectedLocation: () =>
    get().locations.find((l) => l.id === get().selectedLocationId),
  setSelectedLocationId: (id) => set({ selectedLocationId: id }),
  setReportingPeriod: (period) => set({ reportingPeriod: period }),
}))
