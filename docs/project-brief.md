# Project brief — Bathhouse Carbon Reporting System

This document contains the full design context for the Bathhouse Carbon
Reporting System. It is the reference document for all feature development.
Read `CLAUDE.md` first for standing technical instructions.

---

## Client overview

**Bath House** is a British artisan cosmetics and fragrance brand founded in
1997, based in the Lake District, Cumbria. Key facts relevant to this project:

- Certified B Corp — sustainability is a brand USP and a commercial differentiator
- Manufactures all products in-house in small artisan batches in Cumbria
- Operates 7–10 retail shops across the north of England (all UK)
- Supplies hotel amenity products (refillable dispensers) to hotel chains
- Approximately 52 staff across all locations
- Reporting methodology: GHG Protocol Corporate Standard
- Emission factor database: DEFRA UK Conversion Factors (primary),
  Ecoinvent (ingredients), GLEC Framework (freight)
- Voluntary reporter — no mandatory SECR obligation at current scale,
  but reporting to B Corp and external disclosure standards

---

## System purpose

Replace manual spreadsheet-based carbon tracking with a structured internal
web application that:

1. Enables guided data entry for Scope 1, 2, and 3 emissions across all sites
2. Automatically pulls ingredient and packaging data from the stock system
   via INCI database linkage (eliminating manual ingredient data entry)
3. Calculates tCO₂e in real time using versioned DEFRA emission factors
4. Produces audit-ready annual carbon disclosure reports
5. Tracks reduction targets and year-on-year performance
6. Manages the annual staff commuting survey across all sites

---

## Users and roles

Three roles, small team (1–3 active users initially):

### INPUTTER
Day-to-day data entry staff. Assigned to specific locations. Can enter and
edit emission data for their location(s) only. Cannot lock periods or generate
formal reports.

### REVIEWER (sustainability lead / ops manager)
Full read/write access across all locations. Approves entries, identifies
data gaps, locks completed reporting periods, manages the emission factor
library, and triggers the annual commuting survey.

### EXECUTIVE (leadership)
Read-only access. Sees the executive dashboard, summary figures, reduction
targets, and can download reports. Never sees data entry forms.

---

## Location structure

Locations have three types, which drive the data entry UI:

### MANUFACTURING (1 location)
- Manufacturing & HQ, Cumbria
- Most complex location — full Scope 1, 2, and production-specific Scope 3
- Houses the stock system integration (ingredients, packaging auto-sync)

### SHOP (7–10 locations, all UK)
Confirmed shops (placeholder names — confirm with client):
- Keswick, Cumbria
- Ambleside, Cumbria
- Grasmere, Cumbria
- Windermere, Cumbria
- York, North Yorkshire
- Harrogate, North Yorkshire
- Skipton, North Yorkshire

Each shop has:
- Scope 1: gas/heating, refrigerated display units (F-gas), AC units (F-gas)
- Scope 2: electricity (Bathhouse pays bills directly — confirmed)
- Scope 3: operational waste, inter-shop stock transfers, headcount/floor area

Shops do NOT have: ingredients, packaging, inbound freight, production waste.
These are manufacturing-only.

### ORGANISATION (1 virtual location)
Organisation-wide data not belonging to any single site:
- Outbound freight (customer deliveries, hotel deliveries)
- Inter-site transfers
- Staff commuting (all sites, via annual survey)
- Business travel (rail, car, air)
- Staff welfare and catering
- End-of-life product disposal
- Hotel dispenser cycle data
- Reporting metadata (revenue, targets, methodology notes)

---

## Complete data inventory

### Scope 1 — direct emissions

| Data point | Unit | Source | Location |
|---|---|---|---|
| Natural gas consumption | kWh or m³ | Gas bill / meter | Mfg + each shop |
| Company vehicle fuel | litres by fuel type | Fleet log / receipts | Mfg only |
| Process heat fuel | litres / kWh by type | Production records | Mfg only |
| Refrigerant top-up — display units | kg by refrigerant type | F-gas service record | Each shop |
| Refrigerant top-up — AC units | kg by refrigerant type | F-gas service record | Each shop |
| Generator use (if applicable) | litres by fuel type | Site log | Mfg only |

**Critical refrigerant note:** Refrigerant type determines GWP multiplier.
R404A (GWP 3,922) vs R290 propane (GWP 3) — the difference is enormous.
F-gas records must be entered per unit, not aggregated. Always alert the user
if a high-GWP refrigerant is detected (R404A, R410A above 2000 GWP).

### Scope 2 — purchased energy

| Data point | Unit | Source | Location |
|---|---|---|---|
| Grid electricity | kWh | Electricity bill / smart meter | Mfg + each shop |
| Supplier / tariff name | text | Energy contract | Mfg + each shop |
| REGO-backed renewable tariff? | boolean | Energy contract | Mfg + each shop |
| On-site solar generation | kWh | Inverter / generation meter | Mfg only |

**Dual calculation required:** Both location-based (DEFRA grid factor ~0.207
kgCO₂e/kWh for 2024) and market-based (supplier-specific, potentially 0 if
REGO-backed). Both figures must appear in reports.

### Scope 3 — purchased goods (Category 1)

**Ingredients and packaging — AUTO-SYNCED via stock system + INCI database.**
No manual entry required for standard ingredients.

| Data point | Source | Frequency |
|---|---|---|
| Finished product batches (SKU, batch size, date) | Stock system API | Per batch / real-time |
| Sub-ingredient weights per batch (INCI name, kg) | INCI database lookup | Per batch / real-time |
| Packaging material per SKU (type, weight) | Stock system API | Per batch / real-time |
| Packaging recycled content % | Procurement — manual | Annual / on SKU change |
| New ingredient factor mapping | Reviewer — manual | On new INCI ingredient |

**Alert rule:** When a new INCI ingredient appears with no factor mapping,
block that batch from calculations and surface a "unmapped ingredient" alert
to the REVIEWER. Never silently default to zero.

### Scope 3 — freight and logistics (Category 4)

| Data point | Unit | Source | Location |
|---|---|---|---|
| Outbound customer deliveries | kg by carrier/service | 3PL CSV export (DPD etc.) | Organisation |
| Hotel chain deliveries | kg by mode/destination | Dispatch records | Organisation |
| Inbound raw material deliveries | kg by supplier/mode | Goods-in log | Mfg |
| Mfg to shop stock transfers | kg by mode | Internal transfer records | Organisation |
| Inter-shop stock transfers | kg by mode | Internal transfer records | Organisation |

### Scope 3 — operational waste (Category 5)

| Data point | Unit | Source | Location |
|---|---|---|---|
| General waste to landfill | kg | Waste contractor invoice | Mfg + each shop |
| Recycling (by material stream) | kg by type | Waste contractor records | Mfg + each shop |
| Production waste (off-spec product) | kg by material | Production / quality log | Mfg only |
| Hazardous waste | kg + disposal method | Consignment notes | Mfg only |
| Wastewater / trade effluent | m³ | Water company records | Mfg only |

### Scope 3 — business travel (Category 6)

| Data point | Unit | Source | Location |
|---|---|---|---|
| Rail journeys | km or origin/destination | Expense claims / bookings | Organisation |
| Personal car mileage claims | miles by fuel type | Mileage expense records | Organisation |
| Air travel | flights by route and class | Booking records | Organisation |

### Scope 3 — employee commuting (Category 7)

**Data collected via annual staff survey.** Survey sent to all 52 staff across
all 8 locations each April. Results auto-import into the system.

Survey questions per employee:
1. Primary transport mode (car-petrol / car-diesel / car-hybrid / car-EV /
   train / bus / cycle / walk)
2. One-way commute distance in km (or home postcode for auto-calculation)
3. Days per week on-site at a Bathhouse location
4. Days per week working from home

Calculation: `distance × factor × 2 (return) × daysOnSite × 46 weeks / 1000 = tCO₂e`

DEFRA 2024 commuting factors (kgCO₂e per km):
- Car petrol: 0.170 | Car diesel: 0.171 | Car hybrid: 0.106 | Car EV: 0.053
- Train: 0.041 | Bus: 0.089 | Cycle: 0.000 | Walk: 0.000

WFH offset: days WFH reduce the daysOnSite count. A portion of home energy
use is in-boundary per GHG Protocol — capture average WFH days per week.

### Scope 3 — use of sold products (Category 11)

**Hotel channel only.** Products are supplied as refillable dispensers
(not single-use miniatures). This significantly reduces end-of-life complexity.

| Data point | Source |
|---|---|
| Dispenser material and weight | Product spec |
| Average dispenser lifespan (years) | Hotel contract data |
| Annual refill pouch volume per dispenser | Hotel contract data |
| Number of dispensers in circulation | Hotel contract data |

Category 11 (use-phase emissions from showering/bathing) is likely immaterial
for a cosmetics brand — assess and document the exclusion rationale.

### Scope 3 — end-of-life (Category 12)

| Data point | Source |
|---|---|
| Units sold by channel (retail / online / hotel) | Sales system |
| Packaging material breakdown per SKU (% glass, plastic, card, metal) | Product spec sheets |
| Sales by UK region (affects waste treatment factors) | Despatch data |
| Hotel dispenser end-of-life (material, disposal route) | Confirmed with hotel |
| Product returns and disposal volume | Returns / warehouse log |

### Reporting metadata (organisation-wide)

| Data point | Source | Frequency |
|---|---|---|
| Annual revenue (£) | Finance | Annual |
| FTE headcount per site | HR | Annual |
| Floor area per site (m²) | Lease / facilities | Annual |
| Reporting boundary approach | Leadership | Annual |
| Base year and restatement rationale | Previous reports | On change |
| Reduction targets (scope, baseline, %) | Leadership | Annual review |
| Methodology notes and exclusions | Sustainability lead | Annual |

---

## Stock system and INCI integration

This is the most technically distinctive feature of the system.

### How it works

1. The Bath House stock system records every production batch — SKU, quantity
   produced, date.
2. Each SKU has a formulation on file. The INCI database holds the sub-ingredient
   breakdown (INCI name, weight per batch in grams or kg).
3. The carbon system queries the stock system for batches within the reporting
   period and the INCI database for sub-ingredient weights.
4. Each INCI ingredient is mapped to an emission factor (kgCO₂e/kg) in the
   factor library — sourced from Ecoinvent where available, DEFRA spend-based
   as fallback.
5. Calculation: `ingredientWeight (kg) × factor (kgCO₂e/kg) = kgCO₂e`
   Summed across all ingredients, all batches, all SKUs for the period.

### Integration rules

- **Read-only**: the carbon system never writes to the stock system or INCI db.
- **Automatic sync**: no user action required for standard ingredients.
- **Unmapped ingredients**: when a new INCI entry appears with no factor,
  surface an alert to the REVIEWER. Block that batch from totals until resolved.
- **Factor assignment**: the REVIEWER assigns the factor in the carbon system.
  This creates a factor mapping record with an effective date.
- **Packaging**: packaging material weights are also pulled from the stock
  system (material type, weight per unit). Mapped to DEFRA material factors.

### API design notes

The stock system integration should be implemented as a dedicated service
module in `src/lib/stock-integration/`. It should be mockable for development
so the prototype works without a live stock system connection.

---

## UX design decisions

### Visual language

- **Palette**: warm off-white backgrounds, deep charcoal navigation,
  sage green as the primary accent. Feels artisan and considered,
  not corporate. Mirrors Bath House brand aesthetic.
- **Typography**: humanist sans-serif (system-ui as fallback). Clean, legible.
  Brand fonts can be swapped in at the end.
- **Tone**: every form label, help text, and error message should be written
  in plain English. Users are not carbon experts.

### Navigation

- Persistent top navigation bar (dark charcoal)
- **Location selector** sits in the top bar between logo and nav links.
  Switching location is a global context switch — sidebar and content
  update to show only what is relevant for that location type.
- Nav links: Dashboard | Locations | Data entry | Reports | Settings

### Location selector

- Dropdown grouped by type: Manufacturing / Retail shops / Organisation-wide
- Each option shows location name, sub-location, and completion percentage
- Colour-coded dot: green (manufacturing), blue (shops), amber (organisation)
- The selected location persists in Zustand store across navigation

### Sidebar (data entry)

- Shows only emission categories relevant to the selected location type
- Each item has a completion status badge: Done / Pending / Auto / Survey / N/A
- Progress bar at top shows overall completion % for the location
- Active item highlighted with right-border sage green accent

### Data entry content area

- Location-type banner at top (colour-coded) explains what this location covers
- Three stat cards: Scope 1, Scope 2, Site total (tCO₂e)
- Task list below — each emission category as a clickable row showing
  name, hint text, completion badge, and current tCO₂e value
- Clicking a task row opens the specific data entry form

### Live CO₂e preview

All data entry forms show a live tCO₂e calculation that updates as the user
types. This is the most important UX feature — it makes the abstract concept
of carbon concrete and immediately meaningful.

### Forms — general rules

- Every field has a plain-English label and a hint explaining what data is
  needed and where to find it
- Required fields are validated on blur, not on submit
- "Save draft" always available — never lose partial entry
- Readonly fields (auto-synced from stock system) are visually distinct
  (grey background) with a clear "auto" badge
- Destructive actions (locking a period, deleting an entry) require a
  confirmation step

### Staff commuting screen

Three tabs:
1. **Roster** — editable table of all staff with mode, distance, days/wk,
   WFH days. All fields inline-editable. Live tCO₂e column.
2. **Mode summary** — breakdown by transport mode with staff count and tCO₂e
   per mode. Read-only summary view.
3. **Import / survey** — CSV upload zone + survey management (send link to
   all staff, track response rate, auto-import on submission).

### Reports screen (to be designed)

Annual carbon disclosure report generator. Outputs:
- PDF report formatted for voluntary public disclosure
- Structured breakdown by scope and category
- Methodology notes and data quality indicators
- Year-on-year comparison table
- Intensity ratio (tCO₂e per £ revenue)
- Audit trail reference

---

## Screens inventory

Screens to build, in priority order:

1. **App shell** — navigation bar with location selector, page layout
2. **Executive dashboard** — summary stats, scope breakdown, targets, trend chart
3. **Location selector / locations overview** — all sites with completion status
4. **Data entry — shop** — Scope 1 (gas, refrigerants, AC), Scope 2 (electricity),
   Scope 3 (waste, transfers)
5. **Data entry — manufacturing** — full Scope 1/2/3 including auto-synced
   ingredient data
6. **Data entry — organisation-wide** — freight, commuting, travel, end-of-life
7. **Commuting survey form** — employee-facing survey (separate, minimal UI)
8. **Reports** — report generator and download
9. **Settings** — emission factor library management, location management,
   user management

---

## Emission factor library

The factor library is managed by the REVIEWER and updated annually when DEFRA
publishes new conversion factors (typically March/April each year).

Key factor sources:
- **DEFRA UK Conversion Factors** — energy, transport, waste, water, materials
- **GLEC Framework** — freight by mode and distance
- **Ecoinvent** — ingredient-level factors for cosmetic raw materials
- **IPCC AR6** — GWP values for refrigerants

Factor records in the database include:
- `factorName` — human-readable name
- `category` — scope and category (e.g. `SCOPE1_REFRIGERANT`)
- `unit` — denominator unit (e.g. `kg`, `kWh`, `km`, `litre`)
- `kgCO2ePerUnit` — the factor value
- `source` — which database / table reference
- `effectiveFrom` — date from which this factor applies
- `effectiveTo` — nullable; null means currently active

Historical calculations always use the factor active at the end of the
reporting period being calculated — never the current factor.

---

## Prototype scope (Phase 1 build)

The initial coded prototype should demonstrate:

1. App shell with working location selector and navigation
2. Executive dashboard with real calculated figures (seeded data)
3. Data entry for one shop location (Harrogate) — electricity + gas + refrigerants
4. Data entry for organisation-wide commuting (staff roster + live calculation)
5. Stock system integration (mocked) showing auto-synced ingredient data
6. Prisma schema covering all core entities
7. tRPC procedures for emission entry CRUD
8. Zod validation on all forms
9. Calculation engine with tests for all implemented categories

Authentication can be stubbed (single hardcoded session) until core
screens are working.

---

## Key decisions log

| Decision | Rationale |
|---|---|
| Voluntary reporting to GHG Protocol standard | B Corp positioning requires credible methodology |
| Activity-based (not spend-based) for ingredients | Stock + INCI data available — more accurate and defensible |
| Hotel channel uses refillable dispensers | Confirmed by chemist — simplifies end-of-life calculation |
| Shops pay energy bills directly | Confirmed — shop energy is Scope 1/2, not 3 |
| Annual commuting survey, not continuous | Practical for 52 staff across 8 sites |
| SQLite for prototype, PostgreSQL for production | Speed of setup vs production reliability |
| tRPC over REST | Type safety end-to-end — reduces whole class of runtime bugs |
| Recharts over D3 | Maintainability — team visits chart code infrequently |
| 46 working weeks standard | GHG Protocol guidance for commuting calculations |
| Both location-based and market-based Scope 2 | GHG Protocol requires both; REGO tariff may give 0 market-based |
