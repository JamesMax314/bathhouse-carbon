export type LocationType = 'MANUFACTURING' | 'SHOP' | 'ORGANISATION'

export type UserRole = 'INPUTTER' | 'REVIEWER' | 'EXECUTIVE'

export type ReportingPeriodStatus = 'OPEN' | 'LOCKED'

export interface Location {
  id: string
  name: string
  region: string
  type: LocationType
  completionPct: number
}

export interface ReportingPeriod {
  id: string
  label: string
  startDate: string
  endDate: string
  status: ReportingPeriodStatus
}
