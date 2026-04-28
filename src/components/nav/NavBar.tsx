import { fetchLocationsWithCompletion } from '@/lib/locations/completion'
import { LocationSelector } from './LocationSelector'
import { NavLinks } from './NavLinks'

export async function NavBar() {
  const locations = await fetchLocationsWithCompletion()

  return (
    <header className="bg-bh-charcoal h-14 flex items-center px-6 gap-6 shrink-0">
      <BathHouseLogo />
      <LocationSelector locations={locations} />
      <div className="flex-1" />
      <NavLinks />
    </header>
  )
}

function BathHouseLogo() {
  return (
    <div className="flex items-center gap-2 shrink-0">
      <div className="size-7 rounded bg-bh-sage flex items-center justify-center">
        <svg
          viewBox="0 0 24 24"
          className="size-4 text-white"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path d="M12 2L3 7v10l9 5 9-5V7l-9-5z" strokeLinejoin="round" />
        </svg>
      </div>
      <div className="flex flex-col leading-none">
        <span className="text-white text-xs font-semibold tracking-widest uppercase">
          Bath House
        </span>
        <span className="text-white/40 text-[10px] tracking-wide">Carbon reporting</span>
      </div>
    </div>
  )
}
