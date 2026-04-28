'use client'

import { create } from 'zustand'
import type { ReportingPeriod } from '@/types'

const DEFAULT_PERIOD: ReportingPeriod = {
  id: 'period-2024',
  label: 'FY 2024',
  startDate: '2024-01-01',
  endDate: '2024-12-31',
  status: 'OPEN',
}

interface LocationStore {
  selectedLocationId: string
  reportingPeriod: ReportingPeriod
  setSelectedLocationId: (id: string) => void
  setReportingPeriod: (period: ReportingPeriod) => void
}

export const useLocationStore = create<LocationStore>((set) => ({
  selectedLocationId: '',
  reportingPeriod: DEFAULT_PERIOD,
  setSelectedLocationId: (id) => set({ selectedLocationId: id }),
  setReportingPeriod: (period) => set({ reportingPeriod: period }),
}))
