import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

const adapter = new PrismaBetterSqlite3({
  url: process.env.DATABASE_URL as string,
});

const prisma = new PrismaClient({ adapter });

// ─── Fixed IDs — stable across re-runs ───────────────────────────────────────

const ID = {
  users: {
    reviewer: "seed-user-reviewer",
    inputter: "seed-user-inputter",
    executive: "seed-user-executive",
  },
  locations: {
    manufacturing: "seed-loc-manufacturing",
    keswick: "seed-loc-keswick",
    ambleside: "seed-loc-ambleside",
    grasmere: "seed-loc-grasmere",
    windermere: "seed-loc-windermere",
    york: "seed-loc-york",
    harrogate: "seed-loc-harrogate",
    skipton: "seed-loc-skipton",
    organisation: "seed-loc-organisation",
  },
  period: "seed-period-2024-2025",
  categories: {
    s1Gas: "seed-cat-s1-gas",
    s1VehicleFuel: "seed-cat-s1-vehicle-fuel",
    s1ProcessHeat: "seed-cat-s1-process-heat",
    s1Refrigerant: "seed-cat-s1-refrigerant",
    s1Generator: "seed-cat-s1-generator",
    s2Electricity: "seed-cat-s2-electricity",
    s3Ingredients: "seed-cat-s3-ingredients",
    s3Packaging: "seed-cat-s3-packaging",
    s3FreightInbound: "seed-cat-s3-freight-inbound",
    s3FreightOutbound: "seed-cat-s3-freight-outbound",
    s3FreightIntersite: "seed-cat-s3-freight-intersite",
    s3Waste: "seed-cat-s3-waste",
    s3BusinessTravel: "seed-cat-s3-business-travel",
    s3Commuting: "seed-cat-s3-commuting",
    s3UseOfProducts: "seed-cat-s3-use-of-products",
    s3EndOfLife: "seed-cat-s3-end-of-life",
  },
  factors: {
    naturalGas: "seed-factor-natural-gas",
    dieselVehicle: "seed-factor-diesel-vehicle",
    lpg: "seed-factor-lpg",
    dieselGenerator: "seed-factor-diesel-generator",
    gridElectricity: "seed-factor-grid-electricity",
    roadFreight: "seed-factor-road-freight",
    courierDelivery: "seed-factor-courier-delivery",
    intersiteFreight: "seed-factor-intersite-freight",
    wasteToLandfill: "seed-factor-waste-landfill",
    rail: "seed-factor-rail",
    carPetrolCommute: "seed-factor-car-petrol-commute",
    dispenserMaterial: "seed-factor-dispenser-material",
    endOfLifeMixed: "seed-factor-end-of-life-mixed",
    // Ingredient-specific (Ecoinvent — used by IngredientFactorMap)
    ingAqua: "seed-factor-ing-aqua",
    ingRosaCanina: "seed-factor-ing-rosa-canina",
    ingButyrospermum: "seed-factor-ing-butyrospermum",
    ingParfum: "seed-factor-ing-parfum",
    ingCocamidopropyl: "seed-factor-ing-cocamidopropyl",
    ingCedrus: "seed-factor-ing-cedrus",
  },
  entries: {
    mfgGas: "seed-entry-mfg-gas",
    mfgElectricity: "seed-entry-mfg-electricity",
    mfgIngredients: "seed-entry-mfg-ingredients",
    mfgWaste: "seed-entry-mfg-waste",
    mfgVehicleFuel: "seed-entry-mfg-vehicle",
    harrogateGas: "seed-entry-harrogate-gas",
    harrogateElectricity: "seed-entry-harrogate-electricity",
    harrogateWaste: "seed-entry-harrogate-waste",
    keswickGas: "seed-entry-keswick-gas",
    keswickElectricity: "seed-entry-keswick-electricity",
    yorkGas: "seed-entry-york-gas",
    yorkElectricity: "seed-entry-york-electricity",
    orgCommuting: "seed-entry-org-commuting",
    orgBusinessTravel: "seed-entry-org-business-travel",
  },
  refrigerants: {
    keswickR404A: "seed-refrig-keswick-r404a",
    harrogateR290: "seed-refrig-harrogate-r290",
  },
  survey: "seed-survey-2024-2025",
  batches: {
    rosaBodyLotion: "seed-batch-rosa-body-lotion",
    cedarHandWash: "seed-batch-cedar-hand-wash",
  },
  factorMaps: {
    aqua: "seed-fmap-aqua",
    rosaCanina: "seed-fmap-rosa-canina",
    butyrospermum: "seed-fmap-butyrospermum",
    parfum: "seed-fmap-parfum",
    cocamidopropyl: "seed-fmap-cocamidopropyl",
    cedrus: "seed-fmap-cedrus",
  },
  target: "seed-target-org-2030",
} as const;

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** distance × factor × 2 (return) × daysOnSite × 46 weeks / 1000 = tCO₂e */
function commuteTC02e(
  distanceKm: number,
  factorKgPerKm: number,
  daysOnSite: number
): number {
  return parseFloat(
    ((distanceKm * factorKgPerKm * 2 * daysOnSite * 46) / 1000).toFixed(4)
  );
}

// DEFRA 2024 commuting factors (kgCO₂e/km) — from project brief
const COMMUTE_FACTOR = {
  "car-petrol": 0.170,
  "car-diesel": 0.171,
  "car-hybrid": 0.106,
  "car-ev": 0.053,
  train: 0.041,
  bus: 0.089,
  cycle: 0.000,
  walk: 0.000,
} as const;

// ─── Teardown — reverse FK order ─────────────────────────────────────────────

async function clearSeedData() {
  await prisma.auditLog.deleteMany({});
  await prisma.reductionTarget.deleteMany({});
  await prisma.stockSyncIngredient.deleteMany({});
  await prisma.ingredientFactorMap.deleteMany({});
  await prisma.stockSyncBatch.deleteMany({});
  await prisma.commutingResponse.deleteMany({});
  await prisma.commutingSurvey.deleteMany({});
  await prisma.refrigerantEntry.deleteMany({});
  await prisma.emissionEntry.deleteMany({});
  await prisma.emissionFactor.deleteMany({});
  await prisma.emissionCategory.deleteMany({});
  await prisma.reportingPeriod.deleteMany({});
  await prisma.user.deleteMany({});
  await prisma.location.deleteMany({});
}

// ─── Seed functions ───────────────────────────────────────────────────────────

async function seedUsers() {
  await prisma.user.createMany({
    data: [
      {
        id: ID.users.reviewer,
        email: "sarah.mitchell@bathhouse.co.uk",
        name: "Sarah Mitchell",
        role: "REVIEWER",
      },
      {
        id: ID.users.inputter,
        email: "tom.davies@bathhouse.co.uk",
        name: "Tom Davies",
        role: "INPUTTER",
      },
      {
        id: ID.users.executive,
        email: "james.carter@bathhouse.co.uk",
        name: "James Carter",
        role: "EXECUTIVE",
      },
    ],
  });
}

async function seedLocations() {
  await prisma.location.createMany({
    data: [
      {
        id: ID.locations.manufacturing,
        name: "Manufacturing & HQ",
        type: "MANUFACTURING",
        address: "Brewery Arts Centre, Kendal, Cumbria",
        region: "Cumbria",
        floorAreaM2: 1850,
        isActive: true,
      },
      {
        id: ID.locations.keswick,
        name: "Keswick",
        type: "SHOP",
        address: "18 Market Square, Keswick, Cumbria",
        region: "Cumbria",
        floorAreaM2: 95,
        isActive: true,
      },
      {
        id: ID.locations.ambleside,
        name: "Ambleside",
        type: "SHOP",
        address: "3 Lake Road, Ambleside, Cumbria",
        region: "Cumbria",
        floorAreaM2: 80,
        isActive: true,
      },
      {
        id: ID.locations.grasmere,
        name: "Grasmere",
        type: "SHOP",
        address: "Red Lion Square, Grasmere, Cumbria",
        region: "Cumbria",
        floorAreaM2: 65,
        isActive: true,
      },
      {
        id: ID.locations.windermere,
        name: "Windermere",
        type: "SHOP",
        address: "5 Crescent Road, Windermere, Cumbria",
        region: "Cumbria",
        floorAreaM2: 78,
        isActive: true,
      },
      {
        id: ID.locations.york,
        name: "York",
        type: "SHOP",
        address: "21 Stonegate, York, North Yorkshire",
        region: "North Yorkshire",
        floorAreaM2: 110,
        isActive: true,
      },
      {
        id: ID.locations.harrogate,
        name: "Harrogate",
        type: "SHOP",
        address: "7 Parliament Street, Harrogate, North Yorkshire",
        region: "North Yorkshire",
        floorAreaM2: 102,
        isActive: true,
      },
      {
        id: ID.locations.skipton,
        name: "Skipton",
        type: "SHOP",
        address: "14 High Street, Skipton, North Yorkshire",
        region: "North Yorkshire",
        floorAreaM2: 88,
        isActive: true,
      },
      {
        id: ID.locations.organisation,
        name: "Organisation-wide",
        type: "ORGANISATION",
        address: null,
        region: null,
        floorAreaM2: null,
        isActive: true,
      },
    ],
  });

  // Assign inputter to Harrogate and Keswick
  await prisma.user.update({
    where: { id: ID.users.inputter },
    data: {
      assignedLocations: {
        connect: [
          { id: ID.locations.harrogate },
          { id: ID.locations.keswick },
        ],
      },
    },
  });
}

async function seedReportingPeriod() {
  await prisma.reportingPeriod.create({
    data: {
      id: ID.period,
      label: "2024–2025",
      startDate: new Date("2024-04-01"),
      endDate: new Date("2025-03-31"),
      status: "OPEN",
    },
  });
}

async function seedEmissionCategories() {
  await prisma.emissionCategory.createMany({
    data: [
      // Scope 1
      {
        id: ID.categories.s1Gas,
        code: "SCOPE1_GAS",
        scope: 1,
        name: "Natural Gas",
        description: "Combustion of natural gas for space heating and process heat",
        unit: "kWh",
      },
      {
        id: ID.categories.s1VehicleFuel,
        code: "SCOPE1_VEHICLE_FUEL",
        scope: 1,
        name: "Company Vehicle Fuel",
        description: "Fuel consumed by company-owned vehicles",
        unit: "litres",
      },
      {
        id: ID.categories.s1ProcessHeat,
        code: "SCOPE1_PROCESS_HEAT",
        scope: 1,
        name: "Process Heat",
        description: "Fuel used for production heat (LPG, oil, etc.)",
        unit: "litres",
      },
      {
        id: ID.categories.s1Refrigerant,
        code: "SCOPE1_REFRIGERANT",
        scope: 1,
        name: "Refrigerant Top-up (F-gas)",
        description: "Refrigerant leakage from display units and AC — entered per unit via F-gas service records",
        unit: "kg",
      },
      {
        id: ID.categories.s1Generator,
        code: "SCOPE1_GENERATOR",
        scope: 1,
        name: "Generator Use",
        description: "Diesel or petrol consumed by on-site generators",
        unit: "litres",
      },
      // Scope 2
      {
        id: ID.categories.s2Electricity,
        code: "SCOPE2_ELECTRICITY",
        scope: 2,
        name: "Grid Electricity",
        description: "Purchased electricity from the grid — location-based and market-based calculations required",
        unit: "kWh",
      },
      // Scope 3
      {
        id: ID.categories.s3Ingredients,
        code: "SCOPE3_INGREDIENTS",
        scope: 3,
        name: "Purchased Ingredients (Cat 1)",
        description: "Upstream emissions from cosmetic raw material ingredients — auto-synced from stock system via INCI database",
        unit: "kg",
      },
      {
        id: ID.categories.s3Packaging,
        code: "SCOPE3_PACKAGING",
        scope: 3,
        name: "Purchased Packaging (Cat 1)",
        description: "Upstream emissions from packaging materials — auto-synced from stock system",
        unit: "kg",
      },
      {
        id: ID.categories.s3FreightInbound,
        code: "SCOPE3_FREIGHT_INBOUND",
        scope: 3,
        name: "Inbound Freight (Cat 4)",
        description: "Transport of raw materials from suppliers to manufacturing site",
        unit: "tonne-km",
      },
      {
        id: ID.categories.s3FreightOutbound,
        code: "SCOPE3_FREIGHT_OUTBOUND",
        scope: 3,
        name: "Outbound Customer Deliveries (Cat 4)",
        description: "Courier and carrier deliveries to retail customers and hotel chains",
        unit: "kg",
      },
      {
        id: ID.categories.s3FreightIntersite,
        code: "SCOPE3_FREIGHT_INTERSITE",
        scope: 3,
        name: "Inter-site Stock Transfers (Cat 4)",
        description: "Stock movements between manufacturing site and shops, and between shops",
        unit: "tonne-km",
      },
      {
        id: ID.categories.s3Waste,
        code: "SCOPE3_WASTE",
        scope: 3,
        name: "Operational Waste (Cat 5)",
        description: "Waste disposal by stream — landfill, recycling, hazardous, wastewater",
        unit: "kg",
      },
      {
        id: ID.categories.s3BusinessTravel,
        code: "SCOPE3_BUSINESS_TRAVEL",
        scope: 3,
        name: "Business Travel (Cat 6)",
        description: "Staff rail, car mileage claims, and air travel for business purposes",
        unit: "km",
      },
      {
        id: ID.categories.s3Commuting,
        code: "SCOPE3_COMMUTING",
        scope: 3,
        name: "Employee Commuting (Cat 7)",
        description: "Annual staff commuting emissions calculated from the annual survey across all sites",
        unit: "staff-responses",
      },
      {
        id: ID.categories.s3UseOfProducts,
        code: "SCOPE3_USE_OF_PRODUCTS",
        scope: 3,
        name: "Use of Sold Products (Cat 11)",
        description: "Hotel channel only — refillable dispenser lifecycle data",
        unit: "units",
      },
      {
        id: ID.categories.s3EndOfLife,
        code: "SCOPE3_END_OF_LIFE",
        scope: 3,
        name: "End-of-Life Treatment (Cat 12)",
        description: "Disposal of sold products by packaging material type and sales channel",
        unit: "kg",
      },
    ],
  });
}

async function seedEmissionFactors() {
  const effectiveFrom = new Date("2024-01-01");

  await prisma.emissionFactor.createMany({
    data: [
      // ── Scope 1 ──
      {
        id: ID.factors.naturalGas,
        factorName: "Natural gas — gross calorific value",
        categoryId: ID.categories.s1Gas,
        unit: "kWh",
        kgCO2ePerUnit: 0.18254,
        source: "DEFRA 2024 Conversion Factors, Table 1a",
        effectiveFrom,
      },
      {
        id: ID.factors.dieselVehicle,
        factorName: "Diesel — company vehicle",
        categoryId: ID.categories.s1VehicleFuel,
        unit: "litre",
        kgCO2ePerUnit: 2.51867,
        source: "DEFRA 2024 Conversion Factors, Table 3a",
        effectiveFrom,
      },
      {
        id: ID.factors.lpg,
        factorName: "LPG — process heat",
        categoryId: ID.categories.s1ProcessHeat,
        unit: "litre",
        kgCO2ePerUnit: 1.55540,
        source: "DEFRA 2024 Conversion Factors, Table 3a",
        effectiveFrom,
      },
      {
        id: ID.factors.dieselGenerator,
        factorName: "Diesel — generator",
        categoryId: ID.categories.s1Generator,
        unit: "litre",
        kgCO2ePerUnit: 2.51867,
        source: "DEFRA 2024 Conversion Factors, Table 3a",
        effectiveFrom,
      },
      // ── Scope 2 ──
      {
        id: ID.factors.gridElectricity,
        factorName: "UK grid electricity — location-based",
        categoryId: ID.categories.s2Electricity,
        unit: "kWh",
        kgCO2ePerUnit: 0.20705,
        source: "DEFRA 2024 Conversion Factors, Table 3b",
        effectiveFrom,
      },
      // ── Scope 3 — freight ──
      {
        id: ID.factors.roadFreight,
        factorName: "Road freight — HGV average",
        categoryId: ID.categories.s3FreightInbound,
        unit: "tonne-km",
        kgCO2ePerUnit: 0.10367,
        source: "GLEC Framework v3, Road — UK HGV average",
        effectiveFrom,
      },
      {
        id: ID.factors.courierDelivery,
        factorName: "Courier delivery — average parcel",
        categoryId: ID.categories.s3FreightOutbound,
        unit: "kg",
        kgCO2ePerUnit: 0.00181,
        source: "DEFRA 2024 Conversion Factors, Table 4 — van average",
        effectiveFrom,
      },
      {
        id: ID.factors.intersiteFreight,
        factorName: "Inter-site transfer — van",
        categoryId: ID.categories.s3FreightIntersite,
        unit: "tonne-km",
        kgCO2ePerUnit: 0.23076,
        source: "DEFRA 2024 Conversion Factors, Table 3a — van average",
        effectiveFrom,
      },
      // ── Scope 3 — waste ──
      {
        id: ID.factors.wasteToLandfill,
        factorName: "General waste — landfill",
        categoryId: ID.categories.s3Waste,
        unit: "kg",
        kgCO2ePerUnit: 0.44754,
        source: "DEFRA 2024 Conversion Factors, Table 7",
        effectiveFrom,
      },
      // ── Scope 3 — business travel ──
      {
        id: ID.factors.rail,
        factorName: "National rail",
        categoryId: ID.categories.s3BusinessTravel,
        unit: "km",
        kgCO2ePerUnit: 0.04115,
        source: "DEFRA 2024 Conversion Factors, Table 4",
        effectiveFrom,
      },
      // ── Scope 3 — commuting ──
      {
        id: ID.factors.carPetrolCommute,
        factorName: "Car — petrol, employee commuting",
        categoryId: ID.categories.s3Commuting,
        unit: "km",
        kgCO2ePerUnit: 0.170,
        source: "DEFRA 2024 Conversion Factors, Table 4 — commuting factors",
        effectiveFrom,
      },
      // ── Scope 3 — end of life ──
      {
        id: ID.factors.endOfLifeMixed,
        factorName: "Mixed packaging — end of life average",
        categoryId: ID.categories.s3EndOfLife,
        unit: "kg",
        kgCO2ePerUnit: 0.44,
        source: "DEFRA 2024 Conversion Factors, Table 7",
        effectiveFrom,
      },
      // ── Ingredient factors (Ecoinvent — used by IngredientFactorMap) ──
      {
        id: ID.factors.ingAqua,
        factorName: "Aqua (water supply and treatment)",
        categoryId: ID.categories.s3Ingredients,
        unit: "kg",
        kgCO2ePerUnit: 0.001,
        source: "DEFRA 2024 Conversion Factors, Table 6 — water supply",
        effectiveFrom,
      },
      {
        id: ID.factors.ingRosaCanina,
        factorName: "Rosa Canina Fruit Oil (rosehip)",
        categoryId: ID.categories.s3Ingredients,
        unit: "kg",
        kgCO2ePerUnit: 2.81,
        source: "Ecoinvent 3.10 — plant oil, cold pressed",
        effectiveFrom,
      },
      {
        id: ID.factors.ingButyrospermum,
        factorName: "Butyrospermum Parkii (shea butter)",
        categoryId: ID.categories.s3Ingredients,
        unit: "kg",
        kgCO2ePerUnit: 3.21,
        source: "Ecoinvent 3.10 — shea butter production",
        effectiveFrom,
      },
      {
        id: ID.factors.ingParfum,
        factorName: "Parfum / Fragrance compound (blended)",
        categoryId: ID.categories.s3Ingredients,
        unit: "kg",
        kgCO2ePerUnit: 5.14,
        source: "Ecoinvent 3.10 — chemical manufacturing, fragrance average",
        effectiveFrom,
      },
      {
        id: ID.factors.ingCocamidopropyl,
        factorName: "Cocamidopropyl Betaine (surfactant)",
        categoryId: ID.categories.s3Ingredients,
        unit: "kg",
        kgCO2ePerUnit: 2.09,
        source: "Ecoinvent 3.10 — surfactant, coconut-derived",
        effectiveFrom,
      },
      {
        id: ID.factors.ingCedrus,
        factorName: "Cedrus Atlantica Bark Oil (cedarwood essential oil)",
        categoryId: ID.categories.s3Ingredients,
        unit: "kg",
        kgCO2ePerUnit: 4.52,
        source: "Ecoinvent 3.10 — essential oil, steam distilled",
        effectiveFrom,
      },
    ],
  });
}

async function seedEmissionEntries() {
  // Pre-calculated tCO₂e values:
  //   activityValue × kgCO₂ePerUnit / 1000 = tCO₂e
  //   Manufacturing gas: 185000 × 0.18254 / 1000 = 33.770 tCO₂e
  //   Manufacturing electricity: 94500 × 0.20705 / 1000 = 19.566 tCO₂e
  //   Manufacturing waste: 2480 × 0.44754 / 1000 = 1.110 tCO₂e
  //   Manufacturing vehicle fuel: 3150 × 2.51867 / 1000 = 7.934 tCO₂e (DRAFT)
  //   Harrogate gas: 28400 × 0.18254 / 1000 = 5.184 tCO₂e
  //   Harrogate electricity: 22100 × 0.20705 / 1000 = 4.576 tCO₂e
  //   Harrogate waste: 490 × 0.44754 / 1000 = 0.219 tCO₂e
  //   Keswick gas: 31500 × 0.18254 / 1000 = 5.750 tCO₂e
  //   Keswick electricity: 19600 × 0.20705 / 1000 = 4.058 tCO₂e (DRAFT)
  //   York gas: 24800 × 0.18254 / 1000 = 4.527 tCO₂e (DRAFT)
  //   York electricity: 18700 × 0.20705 / 1000 = 3.872 tCO₂e (DRAFT)
  //   Business travel rail: 4200 × 0.04115 / 1000 = 0.173 tCO₂e

  await prisma.emissionEntry.createMany({
    data: [
      // ── Manufacturing ──
      {
        id: ID.entries.mfgGas,
        locationId: ID.locations.manufacturing,
        reportingPeriodId: ID.period,
        categoryId: ID.categories.s1Gas,
        enteredById: ID.users.reviewer,
        emissionFactorId: ID.factors.naturalGas,
        activityValue: 185000,
        unit: "kWh",
        tCO2e: 33.770,
        status: "COMPLETE",
        dataSource: "MANUAL",
        dataQuality: "PRIMARY",
        evidenceRef: "INV-GAS-2024-MFG",
        notes: "Annual gas consumption from meter readings Apr 2024–Mar 2025",
      },
      {
        id: ID.entries.mfgElectricity,
        locationId: ID.locations.manufacturing,
        reportingPeriodId: ID.period,
        categoryId: ID.categories.s2Electricity,
        enteredById: ID.users.reviewer,
        emissionFactorId: ID.factors.gridElectricity,
        activityValue: 94500,
        unit: "kWh",
        tCO2e: 19.566,
        status: "COMPLETE",
        dataSource: "MANUAL",
        dataQuality: "PRIMARY",
        evidenceRef: "INV-ELEC-2024-MFG",
        supplierName: "Good Energy",
        isREGOBacked: true,
        tCO2eMarketBased: 0,
        notes: "REGO-backed renewable tariff — market-based = 0",
      },
      {
        id: ID.entries.mfgIngredients,
        locationId: ID.locations.manufacturing,
        reportingPeriodId: ID.period,
        categoryId: ID.categories.s3Ingredients,
        enteredById: ID.users.reviewer,
        activityValue: 2840,
        unit: "kg",
        tCO2e: 45.2,
        status: "COMPLETE",
        dataSource: "AUTO",
        dataQuality: "PRIMARY",
        notes: "Auto-calculated from stock system sync — all batches Apr 2024–Mar 2025",
      },
      {
        id: ID.entries.mfgWaste,
        locationId: ID.locations.manufacturing,
        reportingPeriodId: ID.period,
        categoryId: ID.categories.s3Waste,
        enteredById: ID.users.reviewer,
        emissionFactorId: ID.factors.wasteToLandfill,
        activityValue: 2480,
        unit: "kg",
        tCO2e: 1.110,
        status: "COMPLETE",
        dataSource: "MANUAL",
        dataQuality: "PRIMARY",
        evidenceRef: "WASTE-CONTRACTOR-2024-MFG",
      },
      {
        id: ID.entries.mfgVehicleFuel,
        locationId: ID.locations.manufacturing,
        reportingPeriodId: ID.period,
        categoryId: ID.categories.s1VehicleFuel,
        enteredById: ID.users.inputter,
        emissionFactorId: ID.factors.dieselVehicle,
        activityValue: 3150,
        unit: "litres",
        tCO2e: 7.934,
        status: "DRAFT",
        dataSource: "MANUAL",
        dataQuality: "ESTIMATED",
        notes: "Fleet log Q1–Q3 only — Q4 figures pending",
      },
      // ── Harrogate ──
      {
        id: ID.entries.harrogateGas,
        locationId: ID.locations.harrogate,
        reportingPeriodId: ID.period,
        categoryId: ID.categories.s1Gas,
        enteredById: ID.users.inputter,
        emissionFactorId: ID.factors.naturalGas,
        activityValue: 28400,
        unit: "kWh",
        tCO2e: 5.184,
        status: "COMPLETE",
        dataSource: "MANUAL",
        dataQuality: "PRIMARY",
        evidenceRef: "INV-GAS-2024-HGT",
      },
      {
        id: ID.entries.harrogateElectricity,
        locationId: ID.locations.harrogate,
        reportingPeriodId: ID.period,
        categoryId: ID.categories.s2Electricity,
        enteredById: ID.users.inputter,
        emissionFactorId: ID.factors.gridElectricity,
        activityValue: 22100,
        unit: "kWh",
        tCO2e: 4.576,
        status: "COMPLETE",
        dataSource: "MANUAL",
        dataQuality: "PRIMARY",
        evidenceRef: "INV-ELEC-2024-HGT",
        supplierName: "Octopus Energy",
        isREGOBacked: false,
        tCO2eMarketBased: 4.576,
      },
      {
        id: ID.entries.harrogateWaste,
        locationId: ID.locations.harrogate,
        reportingPeriodId: ID.period,
        categoryId: ID.categories.s3Waste,
        enteredById: ID.users.inputter,
        emissionFactorId: ID.factors.wasteToLandfill,
        activityValue: 490,
        unit: "kg",
        tCO2e: 0.219,
        status: "COMPLETE",
        dataSource: "MANUAL",
        dataQuality: "PRIMARY",
        evidenceRef: "WASTE-2024-HGT",
      },
      // ── Keswick ──
      {
        id: ID.entries.keswickGas,
        locationId: ID.locations.keswick,
        reportingPeriodId: ID.period,
        categoryId: ID.categories.s1Gas,
        enteredById: ID.users.inputter,
        emissionFactorId: ID.factors.naturalGas,
        activityValue: 31500,
        unit: "kWh",
        tCO2e: 5.750,
        status: "COMPLETE",
        dataSource: "MANUAL",
        dataQuality: "PRIMARY",
        evidenceRef: "INV-GAS-2024-KSK",
      },
      {
        id: ID.entries.keswickElectricity,
        locationId: ID.locations.keswick,
        reportingPeriodId: ID.period,
        categoryId: ID.categories.s2Electricity,
        enteredById: ID.users.inputter,
        emissionFactorId: ID.factors.gridElectricity,
        activityValue: 19600,
        unit: "kWh",
        tCO2e: 4.058,
        status: "DRAFT",
        dataSource: "MANUAL",
        dataQuality: "ESTIMATED",
        notes: "Estimated from previous year — awaiting final bill",
      },
      // ── York ──
      {
        id: ID.entries.yorkGas,
        locationId: ID.locations.york,
        reportingPeriodId: ID.period,
        categoryId: ID.categories.s1Gas,
        enteredById: ID.users.reviewer,
        emissionFactorId: ID.factors.naturalGas,
        activityValue: 24800,
        unit: "kWh",
        tCO2e: 4.527,
        status: "DRAFT",
        dataSource: "MANUAL",
        dataQuality: "ESTIMATED",
        notes: "Estimated from floor area ratio — invoice not yet received",
      },
      {
        id: ID.entries.yorkElectricity,
        locationId: ID.locations.york,
        reportingPeriodId: ID.period,
        categoryId: ID.categories.s2Electricity,
        enteredById: ID.users.reviewer,
        emissionFactorId: ID.factors.gridElectricity,
        activityValue: 18700,
        unit: "kWh",
        tCO2e: 3.872,
        status: "DRAFT",
        dataSource: "MANUAL",
        dataQuality: "ESTIMATED",
      },
      // ── Organisation-wide ──
      {
        id: ID.entries.orgCommuting,
        locationId: ID.locations.organisation,
        reportingPeriodId: ID.period,
        categoryId: ID.categories.s3Commuting,
        enteredById: ID.users.reviewer,
        activityValue: 8,
        unit: "staff-responses",
        tCO2e: 4.627,
        status: "COMPLETE",
        dataSource: "SURVEY",
        dataQuality: "PRIMARY",
        notes: "2024 annual commuting survey — 8 responses from 52 staff",
      },
      {
        id: ID.entries.orgBusinessTravel,
        locationId: ID.locations.organisation,
        reportingPeriodId: ID.period,
        categoryId: ID.categories.s3BusinessTravel,
        enteredById: ID.users.reviewer,
        emissionFactorId: ID.factors.rail,
        activityValue: 4200,
        unit: "km",
        tCO2e: 0.173,
        status: "COMPLETE",
        dataSource: "MANUAL",
        dataQuality: "PRIMARY",
        evidenceRef: "EXPENSE-RAIL-2024",
        notes: "National rail only — no air travel recorded this period",
      },
    ],
  });
}

async function seedRefrigerantEntries() {
  await prisma.refrigerantEntry.createMany({
    data: [
      {
        // R404A — high GWP, triggers UI alert
        // tCO₂e: 0.8 kg × 3922 / 1000 = 3.138
        id: ID.refrigerants.keswickR404A,
        locationId: ID.locations.keswick,
        reportingPeriodId: ID.period,
        enteredById: ID.users.inputter,
        unitDescription: "Refrigerated display unit — chest freezer (confectionery area)",
        refrigerantType: "R404A",
        gwp: 3922,
        topUpMassKg: 0.8,
        tCO2e: 3.138,
        isHighGWP: true,
        notes: "Annual F-gas service record — high GWP refrigerant flagged for phase-out review",
      },
      {
        // R290 — low GWP, no alert
        // tCO₂e: 0.3 kg × 3 / 1000 = 0.0009
        id: ID.refrigerants.harrogateR290,
        locationId: ID.locations.harrogate,
        reportingPeriodId: ID.period,
        enteredById: ID.users.inputter,
        unitDescription: "Refrigerated display unit — propane cooler (skincare area)",
        refrigerantType: "R290",
        gwp: 3,
        topUpMassKg: 0.3,
        tCO2e: 0.001,
        isHighGWP: false,
        notes: "Natural refrigerant — negligible GWP impact",
      },
    ],
  });
}

async function seedCommutingSurvey() {
  // Commuting tCO₂e: distance × factor × 2 × daysOnSite × 46wks / 1000
  const survey = await prisma.commutingSurvey.create({
    data: {
      id: ID.survey,
      reportingPeriodId: ID.period,
      status: "CLOSED",
      sentAt: new Date("2024-04-08"),
      closedAt: new Date("2024-04-22"),
      surveyUrl: "https://bathhouse.co.uk/commute-survey/2024?token=seed-token",
    },
  });

  const responses = [
    {
      staffName: "Sarah Mitchell",
      locationId: ID.locations.manufacturing,
      transportMode: "car-petrol" as const,
      oneWayDistanceKm: 18,
      daysOnSitePerWeek: 4,
      daysWFHPerWeek: 1,
    },
    {
      staffName: "Tom Davies",
      locationId: ID.locations.harrogate,
      transportMode: "train" as const,
      oneWayDistanceKm: 35,
      daysOnSitePerWeek: 3,
      daysWFHPerWeek: 2,
    },
    {
      staffName: "Priya Sharma",
      locationId: ID.locations.manufacturing,
      transportMode: "car-diesel" as const,
      oneWayDistanceKm: 22,
      daysOnSitePerWeek: 5,
      daysWFHPerWeek: 0,
    },
    {
      staffName: "Luke Bennett",
      locationId: ID.locations.york,
      transportMode: "car-ev" as const,
      oneWayDistanceKm: 12,
      daysOnSitePerWeek: 5,
      daysWFHPerWeek: 0,
    },
    {
      staffName: "Fiona Grant",
      locationId: ID.locations.keswick,
      transportMode: "bus" as const,
      oneWayDistanceKm: 8,
      daysOnSitePerWeek: 4,
      daysWFHPerWeek: 1,
    },
    {
      staffName: "Hamid Youssef",
      locationId: ID.locations.harrogate,
      transportMode: "cycle" as const,
      oneWayDistanceKm: 5,
      daysOnSitePerWeek: 5,
      daysWFHPerWeek: 0,
    },
    {
      staffName: "Anna Kowalski",
      locationId: ID.locations.skipton,
      transportMode: "car-hybrid" as const,
      oneWayDistanceKm: 28,
      daysOnSitePerWeek: 3,
      daysWFHPerWeek: 2,
    },
    {
      staffName: "Declan O'Brien",
      locationId: ID.locations.grasmere,
      transportMode: "walk" as const,
      oneWayDistanceKm: 1,
      daysOnSitePerWeek: 5,
      daysWFHPerWeek: 0,
    },
  ];

  await prisma.commutingResponse.createMany({
    data: responses.map((r, i) => ({
      id: `seed-resp-${String(i + 1).padStart(2, "0")}`,
      surveyId: survey.id,
      staffName: r.staffName,
      locationId: r.locationId,
      transportMode: r.transportMode,
      oneWayDistanceKm: r.oneWayDistanceKm,
      daysOnSitePerWeek: r.daysOnSitePerWeek,
      daysWFHPerWeek: r.daysWFHPerWeek,
      tCO2e: commuteTC02e(
        r.oneWayDistanceKm,
        COMMUTE_FACTOR[r.transportMode],
        r.daysOnSitePerWeek
      ),
      submittedAt: new Date("2024-04-18"),
    })),
  });
}

async function seedIngredientFactorMaps() {
  // Maps must exist before batches reference them
  await prisma.ingredientFactorMap.createMany({
    data: [
      {
        id: ID.factorMaps.aqua,
        inciName: "Aqua",
        factorId: ID.factors.ingAqua,
        assignedById: ID.users.reviewer,
        notes: "Water supply and treatment — DEFRA water factor",
      },
      {
        id: ID.factorMaps.rosaCanina,
        inciName: "Rosa Canina Fruit Oil",
        factorId: ID.factors.ingRosaCanina,
        assignedById: ID.users.reviewer,
        notes: "Rosehip seed oil — cold pressed, Ecoinvent 3.10",
      },
      {
        id: ID.factorMaps.butyrospermum,
        inciName: "Butyrospermum Parkii",
        factorId: ID.factors.ingButyrospermum,
        assignedById: ID.users.reviewer,
        notes: "Shea butter — West African supply chain, Ecoinvent 3.10",
      },
      {
        id: ID.factorMaps.parfum,
        inciName: "Parfum",
        factorId: ID.factors.ingParfum,
        assignedById: ID.users.reviewer,
        notes: "Blended fragrance compound — conservative estimate, Ecoinvent 3.10",
      },
      {
        id: ID.factorMaps.cocamidopropyl,
        inciName: "Cocamidopropyl Betaine",
        factorId: ID.factors.ingCocamidopropyl,
        assignedById: ID.users.reviewer,
        notes: "Coconut-derived surfactant, Ecoinvent 3.10",
      },
      {
        id: ID.factorMaps.cedrus,
        inciName: "Cedrus Atlantica Bark Oil",
        factorId: ID.factors.ingCedrus,
        assignedById: ID.users.reviewer,
        notes: "Steam-distilled cedarwood essential oil, Ecoinvent 3.10",
      },
      // Linalool intentionally NOT mapped — tests the unmapped ingredient alert path
    ],
  });
}

async function seedStockSyncBatches() {
  // Batch 1: fully mapped — SYNCED
  // Ingredient tCO₂e: activityWeight × kgCO₂ePerUnit (in kg, not tCO₂e)
  //   Aqua 45kg × 0.001 = 0.045 kgCO₂e
  //   Rosa Canina 8kg × 2.81 = 22.48 kgCO₂e
  //   Butyrospermum 6kg × 3.21 = 19.26 kgCO₂e
  //   Parfum 2kg × 5.14 = 10.28 kgCO₂e
  await prisma.stockSyncBatch.create({
    data: {
      id: ID.batches.rosaBodyLotion,
      locationId: ID.locations.manufacturing,
      reportingPeriodId: ID.period,
      externalBatchId: "BH-2024-0847",
      sku: "ROSA-BODY-LOTION-250",
      productName: "Rose & Neroli Body Lotion 250ml",
      batchDate: new Date("2024-10-15"),
      quantityProduced: 200,
      quantityUnit: "units",
      syncStatus: "SYNCED",
      hasUnmappedIngredients: false,
      syncedAt: new Date("2024-10-15T14:32:00Z"),
      ingredients: {
        createMany: {
          data: [
            {
              inciName: "Aqua",
              weightKg: 45,
              tCO2e: 0.000045,
              factorMapId: ID.factorMaps.aqua,
            },
            {
              inciName: "Rosa Canina Fruit Oil",
              weightKg: 8,
              tCO2e: 0.02248,
              factorMapId: ID.factorMaps.rosaCanina,
            },
            {
              inciName: "Butyrospermum Parkii",
              weightKg: 6,
              tCO2e: 0.01926,
              factorMapId: ID.factorMaps.butyrospermum,
            },
            {
              inciName: "Parfum",
              weightKg: 2,
              tCO2e: 0.01028,
              factorMapId: ID.factorMaps.parfum,
            },
          ],
        },
      },
    },
  });

  // Batch 2: Linalool is unmapped — hasUnmappedIngredients=true, syncStatus=ERROR
  //   Aqua 40kg × 0.001 = 0.040 kgCO₂e
  //   Cocamidopropyl Betaine 12kg × 2.09 = 25.08 kgCO₂e
  //   Cedrus Atlantica 3kg × 4.52 = 13.56 kgCO₂e
  //   Linalool 1.5kg → null (no factor map)
  await prisma.stockSyncBatch.create({
    data: {
      id: ID.batches.cedarHandWash,
      locationId: ID.locations.manufacturing,
      reportingPeriodId: ID.period,
      externalBatchId: "BH-2024-0891",
      sku: "CEDAR-HAND-WASH-300",
      productName: "Cedarwood & Sage Hand Wash 300ml",
      batchDate: new Date("2024-11-03"),
      quantityProduced: 150,
      quantityUnit: "units",
      syncStatus: "ERROR",
      hasUnmappedIngredients: true,
      syncedAt: new Date("2024-11-03T09:17:00Z"),
      ingredients: {
        createMany: {
          data: [
            {
              inciName: "Aqua",
              weightKg: 40,
              tCO2e: 0.00004,
              factorMapId: ID.factorMaps.aqua,
            },
            {
              inciName: "Cocamidopropyl Betaine",
              weightKg: 12,
              tCO2e: 0.02508,
              factorMapId: ID.factorMaps.cocamidopropyl,
            },
            {
              inciName: "Cedrus Atlantica Bark Oil",
              weightKg: 3,
              tCO2e: 0.01356,
              factorMapId: ID.factorMaps.cedrus,
            },
            {
              // Unmapped — tCO2e null, factorMapId null, blocks batch from totals
              inciName: "Linalool",
              weightKg: 1.5,
              tCO2e: null,
              factorMapId: null,
            },
          ],
        },
      },
    },
  });
}

async function seedReductionTarget() {
  const baselineTCO2e = 185.0;
  const targetPct = 50.0;

  await prisma.reductionTarget.create({
    data: {
      id: ID.target,
      name: "50% absolute reduction by 2030 (all scopes)",
      locationId: null, // org-wide
      reportingPeriodId: ID.period,
      scope: null, // all scopes
      targetType: "ABSOLUTE",
      status: "ON_TRACK",
      baselineYear: 2023,
      baselineTCO2e,
      targetPct,
      targetTCO2e: baselineTCO2e * (1 - targetPct / 100),
      notes:
        "Science-aligned target in line with B Corp requirements. Baseline year 2023. " +
        "Midpoint review 2027. Primary levers: renewable electricity, fleet electrification, supply chain engagement.",
    },
  });
}

async function seedAuditLogs() {
  // Seed a handful of representative audit log entries
  await prisma.auditLog.createMany({
    data: [
      {
        emissionEntryId: ID.entries.mfgGas,
        userId: ID.users.reviewer,
        action: "CREATE",
        tableName: "EmissionEntry",
        recordId: ID.entries.mfgGas,
        previousValue: null,
        newValue: JSON.stringify({
          activityValue: 185000,
          unit: "kWh",
          tCO2e: 33.77,
          status: "COMPLETE",
        }),
      },
      {
        emissionEntryId: ID.entries.mfgElectricity,
        userId: ID.users.reviewer,
        action: "CREATE",
        tableName: "EmissionEntry",
        recordId: ID.entries.mfgElectricity,
        previousValue: null,
        newValue: JSON.stringify({
          activityValue: 94500,
          unit: "kWh",
          tCO2e: 19.566,
          status: "COMPLETE",
          supplierName: "Good Energy",
          isREGOBacked: true,
        }),
      },
      {
        emissionEntryId: ID.entries.mfgVehicleFuel,
        userId: ID.users.inputter,
        action: "CREATE",
        tableName: "EmissionEntry",
        recordId: ID.entries.mfgVehicleFuel,
        previousValue: null,
        newValue: JSON.stringify({
          activityValue: 3150,
          unit: "litres",
          tCO2e: 7.934,
          status: "DRAFT",
        }),
      },
      {
        emissionEntryId: ID.entries.harrogateGas,
        userId: ID.users.inputter,
        action: "CREATE",
        tableName: "EmissionEntry",
        recordId: ID.entries.harrogateGas,
        previousValue: null,
        newValue: JSON.stringify({
          activityValue: 28400,
          unit: "kWh",
          tCO2e: 5.184,
          status: "COMPLETE",
        }),
      },
    ],
  });
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("Clearing existing seed data…");
  await clearSeedData();

  console.log("Seeding users…");
  await seedUsers();

  console.log("Seeding locations…");
  await seedLocations();

  console.log("Seeding reporting period…");
  await seedReportingPeriod();

  console.log("Seeding emission categories…");
  await seedEmissionCategories();

  console.log("Seeding emission factors…");
  await seedEmissionFactors();

  console.log("Seeding emission entries…");
  await seedEmissionEntries();

  console.log("Seeding refrigerant entries…");
  await seedRefrigerantEntries();

  console.log("Seeding commuting survey and responses…");
  await seedCommutingSurvey();

  console.log("Seeding ingredient factor maps…");
  await seedIngredientFactorMaps();

  console.log("Seeding stock sync batches and ingredients…");
  await seedStockSyncBatches();

  console.log("Seeding reduction target…");
  await seedReductionTarget();

  console.log("Seeding audit logs…");
  await seedAuditLogs();

  console.log("Done.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
