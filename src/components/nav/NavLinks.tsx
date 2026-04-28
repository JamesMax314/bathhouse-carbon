'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const NAV_ITEMS = [
  { label: 'Dashboard', href: '/' },
  { label: 'Locations', href: '/locations' },
  { label: 'Data entry', href: '/data-entry' },
  { label: 'Reports', href: '/reports' },
  { label: 'Settings', href: '/settings' },
]

export function NavLinks() {
  const pathname = usePathname()

  return (
    <nav className="flex items-center gap-1">
      {NAV_ITEMS.map(({ label, href }) => {
        const isActive =
          href === '/' ? pathname === '/' : pathname.startsWith(href)
        return (
          <Link
            key={href}
            href={href}
            className={[
              'px-3 py-1.5 rounded text-sm font-medium transition-colors',
              isActive
                ? 'bg-bh-charcoal-mid text-white'
                : 'text-white/70 hover:text-white hover:bg-bh-charcoal-mid',
            ].join(' ')}
          >
            {label}
          </Link>
        )
      })}
    </nav>
  )
}
