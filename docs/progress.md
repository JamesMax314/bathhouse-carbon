# Build progress — Bathhouse Carbon Reporting System

This document is the handover context for Claude Code. Read `CLAUDE.md` and
`docs/project-brief.md` first, then use this file to understand what has
already been built before starting new work.

Current branch: `develop`
Last updated: 2026-04-29 (calculation engine)

---

## How to read this document

Checklist items track the **prototype scope** defined in `project-brief.md`
(Screens inventory, Phase 1 build). Items are marked:

- `[x]` — complete and committed to `develop`
- `[~]` — partially complete (detail in notes)
- `[ ]` — not yet started

---

## 1. Project scaffold

- [x] Next.js 14+ App Router project initialised (`create-next-app`)
- [x] TypeScript strict mode enabled (`tsconfig.json`)
- [x] Tailwind CSS v4 configured with full Bath House design token set
  - All `bh-*` colour tokens defined in `src/app/globals.css` via `@theme`
  - All `scope1/2/3`, `auto`, `survey` badge colour tokens defined
  - No raw hex values in components — all via token classes
- [x] ESLint configured (`eslint-config-next`)
- [x] `prisma/dev.db` SQLite database present and seeded (gitignored)

**Key files:** `src/app/globals.css`, `tailwind.config.ts` (tokens inline in CSS)

---

## 2. Data model — Prisma schema

- [x] Schema written at `prisma/schema.prisma` — covers all core entities
- [x] SQLite adapter configured (`@prisma/adapter-better-sqlite3`)
- [x] Prisma client generated

**Models implemented:**

| Model | Purpose |
|---|---|
| `User` | Staff accounts with `INPUTTER \| REVIEWER \| EXECUTIVE` role |
| `Location` | Sites with `MANUFACTURING \| SHOP \| ORGANISATION` type |
| `ReportingPeriod` | Fiscal years with `OPEN \| LOCKED` status |
| `EmissionCategory` | Standardised category codes (SCOPE1_GAS, SCOPE2_ELECTRICITY, etc.) |
| `EmissionFactor` | DEFRA/Ecoinvent/GLEC factors with `effectiveFrom`/`effectiveTo` versioning |
| `EmissionEntry` | Primary emission data rows with tCO₂e, status, data source |
| `RefrigerantEntry` | F-gas records (separate table — GWP-based, per unit) |
| `CommutingSurvey` | Survey lifecycle management |
| `CommutingResponse` | Individual staff commuting responses |
| `StockSyncBatch` | Production batches from stock system |
| `StockSyncIngredient` | Sub-ingredient weights per batch, with factor mapping |
| `IngredientFactorMap` | REVIEWER-assigned INCI → emission factor mappings |
| `AuditLog` | Every EmissionEntry mutation logged (B Corp requirement) |
| `ReductionTarget` | Org-wide and per-location targets with status tracking |

**Schema rules enforced by design:**
- Emission factor versioning (`effectiveFrom`/`effectiveTo`) — historical calculations use the factor active at period end
- Null vs zero distinction — missing data = absent record, not zero
- Locked period awareness — `status: OPEN | LOCKED` on `ReportingPeriod`
- Audit log structure in place (middleware enforcement not yet implemented)

**Key file:** `prisma/schema.prisma`

---

## 3. Seed data

- [x] Seed script at `prisma/seed.ts` — idempotent (clears then re-seeds)
- [x] Run via `npx prisma db seed`

**Seeded data:**

| Entity | What's seeded |
|---|---|
| Users | 3 users: Sarah Mitchell (REVIEWER), Tom Davies (INPUTTER), James Carter (EXECUTIVE) |
| Locations | 9 locations: Manufacturing & HQ (Cumbria), 7 shops, 1 Organisation-wide |
| Reporting period | FY 2024–2025 (2024-04-01 → 2025-03-31), status OPEN |
| Emission categories | All 16 category codes seeded with scope, name, description, unit |
| Emission factors | 13 factors: natural gas, diesel, LPG, generator diesel, grid electricity, road/courier/intersite freight, waste to landfill, rail, car petrol commute, dispenser material, end-of-life mixed, plus 6 Ecoinvent ingredient factors |
| Emission entries | Manufacturing (gas, electricity, ingredients, waste, vehicle fuel), Harrogate (gas, electricity, waste), Keswick (gas, electricity), York (gas, electricity), Organisation (commuting, business travel) |
| Refrigerant entries | Keswick: R404A (high-GWP, triggers alert flag), Harrogate: R290 |
| Stock sync batches | 2 batches: Rosa Body Lotion, Cedar Hand Wash |
| Ingredient factor maps | 6 INCI mappings (Aqua, Rosa Canina, Butyrospermum, Parfum, Cocamidopropyl, Cedrus) |
| Commuting survey | 1 survey (SENT status), with commuting responses for Manufacturing and Harrogate staff |
| Reduction target | Org-wide 50% absolute reduction by 2030 |

**Stable IDs:** All seed records use fixed string IDs (e.g. `seed-loc-manufacturing`, `seed-loc-harrogate`) — safe to re-seed without breaking references.

**Key file:** `prisma/seed.ts`

---

## 4. App shell

- [x] Root layout at `src/app/layout.tsx` — NavBar + main content area, full-height flex column
- [x] NavBar (`src/components/nav/NavBar.tsx`) — async server component, dark charcoal, h-14
  - Fetches locations from DB at render time (no client-side fetch)
- [x] LocationSelector (`src/components/nav/LocationSelector.tsx`) — client component
  - Dropdown grouped by type: Manufacturing / Retail shops / Organisation-wide
  - Type-coded dot: sage (manufacturing), slate-blue (shops), sand (organisation)
  - Completion percentage pill per location (colour-coded: green=100%, amber=partial, grey=0%)
  - Click-outside closes dropdown
  - Initialises selected location to first DB location on mount
- [x] NavLinks (`src/components/nav/NavLinks.tsx`) — client component, active state via `usePathname`
  - Links: Dashboard | Locations | Data entry | Reports | Settings

**Key files:** `src/components/nav/`

---

## 5. Database integration — location selector

- [x] Prisma client singleton at `src/lib/prisma.ts`
  - Uses `PrismaBetterSqlite3` adapter
  - Global singleton pattern for Next.js hot-reload safety
- [x] `fetchLocationsWithCompletion()` at `src/lib/locations/completion.ts`
  - Queries all active locations + the latest OPEN reporting period
  - Computes completion % per location against applicable category list
  - MANUFACTURING: 9 required categories
  - SHOP: 4 required categories (gas, refrigerant, electricity, waste)
  - ORGANISATION: 6 required categories
  - Refrigerant completeness checked against `RefrigerantEntry` table (separate from `EmissionEntry`)
  - Returns `Location[]` shaped to match the `@/types` interface

**Expected completion % with seed data:**

| Location | % |
|---|---|
| Manufacturing & HQ | 56% (5/9 categories covered) |
| Harrogate | 100% (gas + electricity + waste + R290 refrigerant) |
| Keswick | 75% (gas + electricity + R404A refrigerant; no waste entry) |
| York | 50% (gas + electricity; no refrigerant or waste) |
| Organisation-wide | 33% (commuting + business travel; 4 categories missing) |
| Ambleside, Grasmere, Windermere, Skipton | 0% |

**Key files:** `src/lib/prisma.ts`, `src/lib/locations/completion.ts`

---

## 6. State management

- [x] `src/stores/location-store.ts` — Zustand store
  - Manages `selectedLocationId` (string) and `reportingPeriod`
  - Locations themselves are server-fetched and passed as props — not stored in Zustand
  - `setSelectedLocationId` / `setReportingPeriod` actions
- [x] `src/stores/ui-store.ts` — Zustand store
  - Manages `sidebarOpen` boolean with `toggleSidebar` / `setSidebarOpen`

**Key files:** `src/stores/`

---

## 7. Type definitions

- [x] `src/types/index.ts`
  - `LocationType`: `'MANUFACTURING' | 'SHOP' | 'ORGANISATION'`
  - `UserRole`: `'INPUTTER' | 'REVIEWER' | 'EXECUTIVE'`
  - `ReportingPeriodStatus`: `'OPEN' | 'LOCKED'`
  - `Location`: `{ id, name, region, type, completionPct }`
  - `ReportingPeriod`: `{ id, label, startDate, endDate, status }`

---

## 8. Placeholder pages

All pages render a styled placeholder — correct page title, subtitle, and a
bordered placeholder panel. Ready to be replaced with real content.

- [x] `/` — Executive dashboard (`src/app/page.tsx`)
- [x] `/locations` — Locations overview (`src/app/locations/page.tsx`)
- [x] `/data-entry` — Data entry (`src/app/data-entry/page.tsx`)
- [x] `/reports` — Reports (`src/app/reports/page.tsx`)
- [x] `/settings` — Settings (`src/app/settings/page.tsx`)

---

## 9. tRPC API layer

- [x] `@trpc/server`, `@trpc/client`, `@trpc/react-query`, `@tanstack/react-query`, `zod`, `superjson` installed
- [x] `src/server/trpc.ts` — tRPC initialisation with Prisma context, `router` and `publicProcedure` exports
- [x] `src/server/routers/locations.ts` — `list` (all active), `byId`
- [x] `src/server/routers/emissions.ts` — `listByLocation`, `byId`, `create`, `update`, `delete`
  - Locked-period guard on all mutations — throws `FORBIDDEN` if `ReportingPeriod.status === 'LOCKED'`
- [x] `src/server/routers/factors.ts` — `listByCategory`, `activeForDate` (effectiveFrom date-range lookup)
- [x] `src/server/routers/_app.ts` — root router combining all sub-routers; exports `AppRouter` type
- [x] `src/app/api/trpc/[trpc]/route.ts` — Next.js App Router fetch handler (GET + POST)
- [x] `src/lib/trpc/client.ts` — typed `trpc` React client via `createTRPCReact<AppRouter>`
- [x] `src/components/providers/TRPCProvider.tsx` — `QueryClient` + tRPC provider (client component)
- [x] `src/schemas/emission-entry.ts` — Zod `CreateEmissionEntrySchema` and `UpdateEmissionEntrySchema`
- [x] `src/app/layout.tsx` updated — root layout wrapped with `TRPCProvider`

**SuperJSON transformer** is configured on both server and client — handles `Date` serialisation end-to-end.

**Key files:** `src/server/`, `src/schemas/emission-entry.ts`, `src/lib/trpc/`, `src/components/providers/TRPCProvider.tsx`

---

## 10. What is NOT yet built (Phase 1 remaining work)

Ordered by project-brief priority:

### Executive dashboard (`/`)
- [ ] Stat cards: total tCO₂e, Scope 1, Scope 2, Scope 3
- [ ] Scope breakdown chart (Recharts)
- [ ] Year-on-year trend chart (Recharts)
- [ ] Reduction target progress bar
- [ ] Per-location summary table

### Locations overview (`/locations`)
- [ ] Location cards showing type, completion %, tCO₂e total
- [ ] Grouped by type (Manufacturing / Shops / Organisation)
- [ ] Click-through to data entry for that location

### Data entry — shared infrastructure
- [ ] `[locationId]/[section]` route structure
- [ ] Sidebar with per-location emission category list and completion badges
- [ ] Location-type banner (colour-coded)
- [ ] Scope 1 / Scope 2 / site total stat cards
- [x] tRPC setup (`@trpc/server`, `@trpc/client`, `@trpc/react-query`)
- [~] tRPC routers: `emissions`, `locations`, `factors` done — `survey`, `reports` still pending
- [~] Zod schemas in `src/schemas/` — `emission-entry.ts` done; location, survey, reporting-period schemas pending
- [ ] React Hook Form integration

### Data entry — shop (Harrogate prototype)
- [ ] Scope 1: natural gas form with live tCO₂e preview
- [ ] Scope 1: refrigerant form (per-unit, GWP lookup, high-GWP alert)
- [ ] Scope 2: electricity form (location-based + market-based dual calculation)
- [ ] Scope 3: operational waste form

### Data entry — manufacturing
- [ ] Full Scope 1 (gas, vehicle fuel, process heat, generator, refrigerant)
- [ ] Scope 2 electricity
- [ ] Scope 3 ingredients (auto-synced — mock stock integration)
- [ ] Scope 3 packaging (auto-synced)
- [ ] Scope 3 inbound freight
- [ ] Scope 3 waste

### Data entry — organisation-wide
- [ ] Outbound freight form
- [ ] Inter-site transfers form
- [ ] Business travel form
- [ ] Staff commuting roster (inline editable table, live tCO₂e)
- [ ] Commuting mode summary tab
- [ ] Survey management tab (send link, track response rate)

### Calculation engine (`src/lib/calculations/`)
- [x] `scope1.ts` — `calculateGasCombustion`, `calculateFuelCombustion`, `calculateGaseousFuelCombustion`
- [x] `scope2.ts` — `calculateElectricityLocationBased`, `calculateElectricityMarketBased` (returns `{ tCO2e, zeroed }`)
- [x] `scope3-ingredients.ts` — `calculateIngredientEmissions`, `calculateBatchIngredients` (returns unmapped list), `calculatePackagingEmissions`
- [x] `scope3-freight.ts` — `calculateFreightEmissions` (tonne-km), `calculateParcelDelivery` (per-kg), `calculateFreightTotal`
- [x] `scope3-waste.ts` — `calculateWasteEmissions`, `calculateWasteStreams`, `calculateWastewaterEmissions`
- [x] `refrigerants.ts` — `calculateRefrigerantEmissions`, `isHighGWP`, `lookupGWP`; IPCC AR6 GWP constants for 9 common refrigerants
- [x] `commuting.ts` — `calculateCommuterEmissions`, `calculateRosterEmissions`; DEFRA 2024 per-mode factors as constants
- [x] `totals.ts` — `sumEntries`, `calculateOrganisationTotal` (dual Scope 2), `calculateIntensityRatio`, `calculateYearOnYearChange`
- [x] `calculations.test.ts` — 112 Vitest unit tests; all use real DEFRA 2024 / IPCC AR6 values
- [x] `src/lib/errors.ts` — `CalculationInputError` (with `field` property) and `EmissionFactorNotFoundError`
- [x] `src/lib/emission-factors/resolver.ts` — `resolveEmissionFactor()` queries Prisma for versioned factor active at period end; throws `EmissionFactorNotFoundError`, never returns null
- [ ] `src/lib/emission-factors/defra-2024.ts` — DEFRA factor constants (factors currently hardcoded in tests / seeded in DB)
- [ ] `src/lib/emission-factors/glec-freight.ts` — GLEC freight factors

### Emission factor library
- [~] `factors.ts` tRPC router — read queries done (`listByCategory`, `activeForDate`); REVIEWER CRUD (create/update) still pending
- [x] Factor lookup with `effectiveFrom` date matching

### Audit log middleware
- [ ] Prisma middleware that writes `AuditLog` on every `EmissionEntry` mutation

### Stock system integration (mocked)
- [ ] `src/lib/stock-integration/` service module
- [ ] Mock stock data returning batches + INCI ingredient weights
- [ ] Unmapped ingredient alert surfaced to REVIEWER

### Authentication
- [ ] NextAuth.js (Auth.js v5) setup — stubbed single session acceptable for Phase 1
- [ ] Role-based middleware on tRPC procedures
- [ ] Role-based UI gating (EXECUTIVE = read-only, INPUTTER = assigned locations only)

### Reports (`/reports`)
- [ ] Annual report generator
- [ ] PDF output
- [ ] Year-on-year comparison table
- [ ] Intensity ratio (tCO₂e / £ revenue)
- [ ] Methodology notes and audit trail reference

### Testing
- [x] Vitest installed and configured (`vitest.config.ts` with `@/` path alias); `npm run test` and `npm run test:watch` scripts added
- [x] Unit tests for all calculation functions — 112 tests, all passing
- [ ] React Testing Library setup (needed for form component tests)
- [ ] Integration tests for tRPC procedures (`tests/integration/`)

---

## 11. Architectural decisions made so far

| Decision | Detail |
|---|---|
| Locations fetched server-side | `NavBar` is an async server component — no client-side data fetch for locations |
| Locations not stored in Zustand | Passed as props from server components; Zustand only holds `selectedLocationId` |
| Completion % is category-coverage based | Any entry for a required category counts, regardless of DRAFT/COMPLETE status |
| Refrigerant completeness uses `RefrigerantEntry` | Separate from `EmissionEntry` — checked independently in completion logic |
| Applicable categories defined in code | `APPLICABLE_CATEGORIES` map in `src/lib/locations/completion.ts` — not in DB |
| tRPC v11 installed | `@trpc/server`, `@trpc/client`, `@trpc/react-query` — routers live in `src/server/routers/` |
| SuperJSON transformer | Configured on both server and client — handles `Date` objects across the wire |
| TRPCProvider wraps root layout | Client-side `QueryClient` + tRPC provider in `src/components/providers/TRPCProvider.tsx` |
| Auth stubbed | No NextAuth.js yet — all pages accessible without login |
| Calculation functions are pure | No DB or API calls inside calculation modules — factor lookup handled separately by `resolver.ts` |
| Scope 3 split into four files | `scope3-ingredients`, `scope3-freight`, `scope3-waste` (+ commuting is its own file) — matches brief's category structure |
| `calculateBatchIngredients` returns unmapped list | Never silently omits unmapped INCI ingredients — caller must surface the alert |
| Dual Scope 2 output | `calculateElectricityMarketBased` returns `{ tCO2e, zeroed }` so UI can distinguish REGO-zeroed from genuinely zero |
