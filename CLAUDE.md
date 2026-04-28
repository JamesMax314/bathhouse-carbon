# CLAUDE.md — Bathhouse Carbon Reporting System

This file is read automatically by Claude Code at the start of every session.
It contains standing instructions, architectural decisions, and project principles
that must be followed throughout the entire codebase.

---

## Project overview

An internal carbon reporting web application for **Bath House** — a UK-based
artisan cosmetics and fragrance brand (B Corp certified, Lake District). The
system enables staff to input, track, and report Scope 1, 2, and 3 greenhouse
gas emissions across all company locations, in line with the GHG Protocol
Corporate Standard.

Full design context, UX decisions, and data requirements are documented in
`docs/project-brief.md`. Read that file before building any new feature.

---

## Core principles — never compromise these

### 1. Maintainability and human readability
- Every file, function, and variable must be named to communicate intent clearly.
  A future developer should understand what code does without reading comments.
- Extract repeated UI patterns into named components immediately — never
  copy-paste raw Tailwind utility strings across files.
- Keep components small and single-purpose. If a component exceeds ~150 lines,
  split it.
- Co-locate related files: a component, its types, and its tests live together.

### 2. Performance
- Use Next.js Server Components by default. Only add `"use client"` when
  interactivity is genuinely required (forms, live calculations, dropdowns).
- Never fetch data client-side that could be fetched server-side.
- Memoize expensive calculations (emission factor lookups, tCO₂e totals) with
  `useMemo`. Use `React.memo` on pure display components in large lists.
- The staff roster table may grow to 50+ rows — use `@tanstack/react-virtual`
  for virtualisation if rendering becomes slow.

### 3. Bug-free
- TypeScript strict mode is enabled and must stay enabled. Never use `any`.
- All user inputs must be validated with Zod schemas. The same schema validates
  on both client (React Hook Form) and server (tRPC procedure). Never duplicate
  validation logic.
- Carbon calculations are safety-critical for reporting accuracy. Every
  calculation function must have a corresponding unit test. Run tests before
  every commit.
- Emission factor lookups must always check for a valid factor and throw a
  typed error if one is missing — never silently return zero.

---

## Tech stack

| Layer | Choice | Notes |
|---|---|---|
| Framework | Next.js 14+ (App Router) | Server components by default |
| Language | TypeScript (strict) | No `any`, no type assertions without comment |
| Styling | Tailwind CSS | Custom BH token config — see below |
| Database | SQLite → PostgreSQL | SQLite for dev/prototype, Postgres for production |
| ORM | Prisma | Schema-first, migrations tracked in version control |
| API | tRPC | Type-safe end-to-end, no manual API schemas |
| State | Zustand | Local UI state only — server state via TanStack Query |
| Server state | TanStack Query (React Query) | All data fetching and caching |
| Forms | React Hook Form + Zod | Shared Zod schemas between client and server |
| Auth | NextAuth.js (Auth.js v5) | Magic link or Google OAuth, role-based access |
| Charts | Recharts | Styled to Bath House palette |
| Testing | Vitest + React Testing Library | Unit tests for calculations, integration for forms |

---

## Tailwind — Bath House design tokens

The following custom tokens are configured in `tailwind.config.ts` and must be
used instead of raw Tailwind colour classes wherever the Bath House palette
applies. Never hardcode hex values in components.

```
bh-charcoal     #2c2a25   — primary dark (nav bar, primary text)
bh-charcoal-mid #3d3a34   — nav hover states
bh-stone        #f7f4ef   — page background
bh-stone-mid    #f0ece5   — sidebar background
bh-stone-dark   #e0dbd2   — borders
bh-sage         #7a9e6a   — primary accent (progress, positive delta, CTA)
bh-sage-light   #e4ede1   — sage tint backgrounds
bh-sand         #c4a87a   — organisation-wide accent
bh-terracotta   #c07a6a   — warning / high-emission alerts
bh-text-primary #2c2a25
bh-text-muted   #7a7770
bh-text-hint    #9a9690
```

Scope colour coding (used consistently across all UI):
```
scope-1   warm stone tones  — #f0ece6 bg / #5a4535 text
scope-2   sage green tones  — #e4ede1 bg / #2e5028 text
scope-3   slate blue tones  — #e6ecf8 bg / #2a3e7a text
auto      purple tones      — #ede6f8 bg / #3e2a7a text  (stock sync)
survey    soft red tones    — #fce8e8 bg / #7a2a2a text  (pending survey)
```

---

## Project structure

```
bathhouse-carbon/
├── CLAUDE.md                          ← you are here
├── docs/
│   └── project-brief.md               ← full design context
├── prisma/
│   ├── schema.prisma                  ← single source of truth for data model
│   └── migrations/                    ← never edit manually
├── src/
│   ├── app/                           ← Next.js App Router pages
│   │   ├── (dashboard)/
│   │   │   └── page.tsx               ← executive dashboard
│   │   ├── data-entry/
│   │   │   └── [locationId]/
│   │   │       └── [section]/
│   │   │           └── page.tsx       ← location-aware data entry
│   │   ├── reports/
│   │   │   └── page.tsx
│   │   └── locations/
│   │       └── page.tsx
│   ├── components/
│   │   ├── ui/                        ← primitive components (Button, Badge, Card)
│   │   ├── nav/                       ← NavBar, LocationSelector, SideBar
│   │   ├── dashboard/                 ← StatCard, ScopeBreakdown, TrendChart
│   │   ├── data-entry/                ← form components per scope/category
│   │   └── reports/                   ← ReportGenerator, AuditTrail
│   ├── server/
│   │   ├── routers/                   ← tRPC routers (one per domain)
│   │   │   ├── emissions.ts
│   │   │   ├── locations.ts
│   │   │   ├── factors.ts
│   │   │   ├── survey.ts
│   │   │   └── reports.ts
│   │   └── trpc.ts                    ← tRPC initialisation
│   ├── lib/
│   │   ├── calculations/              ← pure calculation functions + tests
│   │   │   ├── scope1.ts
│   │   │   ├── scope2.ts
│   │   │   ├── scope3.ts
│   │   │   ├── refrigerants.ts
│   │   │   ├── commuting.ts
│   │   │   └── calculations.test.ts
│   │   ├── emission-factors/          ← DEFRA factor constants + lookup functions
│   │   │   ├── defra-2024.ts
│   │   │   ├── glec-freight.ts
│   │   │   └── factors.test.ts
│   │   └── utils.ts                   ← shared utilities (rounding, formatting)
│   ├── schemas/                       ← Zod schemas shared by client and server
│   │   ├── emission-entry.ts
│   │   ├── location.ts
│   │   ├── survey.ts
│   │   └── reporting-period.ts
│   ├── stores/                        ← Zustand stores
│   │   ├── location-store.ts          ← selected location, reporting period
│   │   └── ui-store.ts                ← sidebar state, modal state
│   └── types/                         ← shared TypeScript types
│       └── index.ts
└── tests/
    └── integration/                   ← integration tests for tRPC procedures
```

---

## Database — key schema rules

These constraints must be respected when modifying `schema.prisma`:

1. **Emission factor versioning** — every factor record has an `effectiveFrom`
   date. Historical calculations must always use the factor that was active
   during the reporting period, not the current factor.

2. **Audit log** — every `EmissionEntry` mutation (create, update, delete) must
   write a corresponding `AuditLog` record automatically via a Prisma middleware.
   This is non-negotiable for B Corp reporting credibility.

3. **Location hierarchy** — locations have a `type` enum:
   `MANUFACTURING | SHOP | ORGANISATION`. The data entry UI is driven by this
   type — never hardcode location-specific logic in components.

4. **Reporting periods** — all emission entries belong to a `ReportingPeriod`.
   A period can be `OPEN` or `LOCKED`. Locked periods must reject any write
   operations at the tRPC layer.

5. **Null vs zero** — a missing emission entry (data not yet collected) is
   represented as the absence of a record, not a record with value zero.
   Zero is a valid, meaningful measurement. This distinction matters for
   completion tracking and uncertainty reporting.

---

## Calculation engine rules

All calculation functions live in `src/lib/calculations/` and must be:

- **Pure functions** — no side effects, no database calls, no API calls.
  Input data in, tCO₂e out.
- **Explicitly typed** — every parameter and return value is typed.
- **Tested** — every function has at least one happy-path and one edge-case
  test in `calculations.test.ts`.
- **Documented** — a JSDoc comment explains the formula source
  (e.g. `@see DEFRA 2024 Conversion Factors, Table 1a`).

Core formula: `activityData (unit) × emissionFactor (kgCO₂e/unit) / 1000 = tCO₂e`

Refrigerant formula: `topUpMass (kg) × GWP / 1000 = tCO₂e`

Commuting formula: `distance (km) × factor (kgCO₂e/km) × 2 (return) × daysOnSite × weeksWorked / 1000 = tCO₂e`
Use 46 working weeks as the standard annual figure unless overridden.

---

## Role-based access

Three roles, enforced at the tRPC middleware layer:

| Role | Access |
|---|---|
| `INPUTTER` | Read + write emission entries for assigned locations only |
| `REVIEWER` | Read + write all locations, can approve entries |
| `EXECUTIVE` | Read-only — dashboard and reports only |

Never enforce roles only in the UI — always enforce at the API/tRPC layer.

---

## Stock system & INCI integration

The stock system integration is the core of the Scope 3 ingredient calculation.
Integration details are in `docs/project-brief.md`. Key rules:

- Stock data flows in automatically — users never manually enter ingredient weights.
- When a new INCI ingredient appears that has no emission factor mapping, the
  system must surface an alert and block that batch from being included in
  calculations until the factor is assigned. Never silently default to zero.
- The integration is read-only — the carbon system never writes back to the
  stock system.

---

## Code style

- Use named exports, not default exports, for components. Exception: Next.js
  page files which require default exports.
- Prefer `const` arrow functions for utilities; use `function` declarations for
  React components (easier to read in stack traces).
- No inline styles — everything goes through Tailwind tokens.
- Format with Prettier on save. ESLint must pass with zero warnings before commit.
- Commit messages follow Conventional Commits:
  `feat:`, `fix:`, `chore:`, `docs:`, `test:`

---

## Git workflow

- Never commit directly to `main` or `develop`
- Create a feature branch before starting any new screen or feature:
  `git checkout -b feat/description-of-feature`
- Commit after each logical unit of work — not at end of session
- Commit messages follow Conventional Commits:
  `feat: add location selector to nav bar`
  `fix: correct refrigerant GWP calculation for R404A`
  `test: add unit tests for commuting tCO2e formula`
- Always run `npm run lint` and `npm run test` before committing
- Never commit with failing tests or lint errors
- Write a meaningful commit message — not "wip" or "update"
