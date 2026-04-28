export default function DataEntryPage() {
  return (
    <div className="p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-2xl font-semibold text-bh-text-primary mb-1">
          Data entry
        </h1>
        <p className="text-bh-text-muted text-sm mb-8">
          Select a location from the top bar to begin entering emission data.
        </p>

        <div className="rounded-xl border border-bh-stone-dark bg-white p-12 flex items-center justify-center text-bh-text-hint text-sm">
          Location-specific data entry forms coming soon.
        </div>
      </div>
    </div>
  )
}
