'use client'

import { useState, useRef, useEffect } from 'react'
import { useLocationStore } from '@/stores/location-store'
import { SEED_LOCATIONS } from '@/lib/data/locations'
import type { Location, LocationType } from '@/types'

const TYPE_LABELS: Record<LocationType, string> = {
  MANUFACTURING: 'Manufacturing',
  SHOP: 'Retail shops',
  ORGANISATION: 'Organisation-wide',
}

const TYPE_DOT_COLOUR: Record<LocationType, string> = {
  MANUFACTURING: 'bg-bh-sage',
  SHOP: 'bg-scope3-text',
  ORGANISATION: 'bg-bh-sand',
}

const GROUP_ORDER: LocationType[] = ['MANUFACTURING', 'SHOP', 'ORGANISATION']

function groupByType(locations: Location[]): Record<LocationType, Location[]> {
  return {
    MANUFACTURING: locations.filter((l) => l.type === 'MANUFACTURING'),
    SHOP: locations.filter((l) => l.type === 'SHOP'),
    ORGANISATION: locations.filter((l) => l.type === 'ORGANISATION'),
  }
}

export function LocationSelector() {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const { selectedLocationId, setSelectedLocationId, selectedLocation } =
    useLocationStore()

  const current = selectedLocation()
  const groups = groupByType(SEED_LOCATIONS)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  function handleSelect(id: string) {
    setSelectedLocationId(id)
    setOpen(false)
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 px-3 py-1.5 rounded bg-bh-charcoal-mid hover:bg-white/10 transition-colors text-sm text-white"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        {current && (
          <span
            className={[
              'size-2 rounded-full shrink-0',
              TYPE_DOT_COLOUR[current.type],
            ].join(' ')}
          />
        )}
        <span className="font-medium">
          {current?.name ?? 'Select location'}
        </span>
        {current?.region && (
          <span className="text-white/50">— {current.region}</span>
        )}
        <ChevronIcon open={open} />
      </button>

      {open && (
        <div
          role="listbox"
          className="absolute top-full left-0 mt-1 w-72 rounded-lg border border-bh-stone-dark bg-white shadow-lg z-50 py-1 overflow-hidden"
        >
          {GROUP_ORDER.map((type) => {
            const locs = groups[type]
            if (!locs.length) return null
            return (
              <div key={type}>
                <div className="px-3 py-1.5 text-xs font-semibold text-bh-text-hint uppercase tracking-wide">
                  {TYPE_LABELS[type]}
                </div>
                {locs.map((loc) => (
                  <button
                    key={loc.id}
                    role="option"
                    aria-selected={loc.id === selectedLocationId}
                    onClick={() => handleSelect(loc.id)}
                    className={[
                      'w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left transition-colors',
                      loc.id === selectedLocationId
                        ? 'bg-bh-sage-light text-bh-text-primary'
                        : 'text-bh-text-primary hover:bg-bh-stone',
                    ].join(' ')}
                  >
                    <span
                      className={[
                        'size-2 rounded-full shrink-0',
                        TYPE_DOT_COLOUR[loc.type],
                      ].join(' ')}
                    />
                    <span className="flex-1 font-medium">{loc.name}</span>
                    {loc.region && (
                      <span className="text-bh-text-hint text-xs">
                        {loc.region}
                      </span>
                    )}
                    <CompletionPill pct={loc.completionPct} />
                  </button>
                ))}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      className={['size-3.5 text-white/50 transition-transform', open ? 'rotate-180' : ''].join(' ')}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path d="M4 6l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function CompletionPill({ pct }: { pct: number }) {
  const colour =
    pct === 100
      ? 'bg-scope2-bg text-scope2-text'
      : pct > 0
        ? 'bg-bh-sand/20 text-bh-text-muted'
        : 'bg-bh-stone-dark text-bh-text-hint'

  return (
    <span className={['text-xs px-1.5 py-0.5 rounded font-medium', colour].join(' ')}>
      {pct}%
    </span>
  )
}
