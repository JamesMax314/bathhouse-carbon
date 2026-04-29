import { z } from 'zod';
import type { PrismaClient } from '@prisma/client';
import { router, publicProcedure, TRPCError } from '../trpc';
import {
  CreateEmissionEntrySchema,
  UpdateEmissionEntrySchema,
  EmissionEntryFormInputSchema,
  type EmissionEntryFormInput,
} from '@/schemas/emission-entry';
import { resolveEmissionFactor, type ResolvedFactor } from '@/lib/emission-factors/resolver';
import { EmissionFactorNotFoundError, CalculationInputError } from '@/lib/errors';
import { calculateGasCombustion, calculateFuelCombustion } from '@/lib/calculations/scope1';
import {
  calculateElectricityLocationBased,
  calculateElectricityMarketBased,
} from '@/lib/calculations/scope2';

// ─── Shared helpers ───────────────────────────────────────────────────────────

async function assertPeriodOpen(prisma: PrismaClient, reportingPeriodId: string) {
  const period = await prisma.reportingPeriod.findUniqueOrThrow({
    where: { id: reportingPeriodId },
  });
  if (period.status === 'LOCKED') {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'This reporting period is locked and cannot be modified.',
    });
  }
}

interface CalculationResult {
  tCO2e: number
  tCO2eMarketBased: number | undefined
  factor: ResolvedFactor
  categoryId: string
}

/**
 * Resolves the versioned emission factor and computes tCO₂e for the given
 * form input. Shared by calculateAndPreview (no DB write) and createEntry (writes).
 * Converts typed calculation errors into TRPCErrors so callers get structured responses.
 */
async function resolveAndCalculate(
  prisma: PrismaClient,
  input: EmissionEntryFormInput,
): Promise<CalculationResult> {
  const period = await prisma.reportingPeriod.findUniqueOrThrow({
    where: { id: input.reportingPeriodId },
  });

  const category = await prisma.emissionCategory.findUnique({
    where: { code: input.categoryCode },
  });
  if (!category) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: `Unknown emission category code: "${input.categoryCode}"`,
    });
  }

  let factor: ResolvedFactor;
  try {
    factor = await resolveEmissionFactor({
      categoryCode: input.categoryCode,
      factorName: input.factorName,
      periodEndDate: period.endDate,
    });
  } catch (err) {
    if (err instanceof EmissionFactorNotFoundError) {
      throw new TRPCError({ code: 'NOT_FOUND', message: err.message });
    }
    throw err;
  }

  let tCO2e: number;
  let tCO2eMarketBased: number | undefined;

  try {
    switch (input.categoryCode) {
      case 'SCOPE1_GAS':
        tCO2e = calculateGasCombustion(input.activityValue, factor.kgCO2ePerUnit);
        break;

      case 'SCOPE1_VEHICLE_FUEL':
      case 'SCOPE1_PROCESS_HEAT':
      case 'SCOPE1_GENERATOR':
        tCO2e = calculateFuelCombustion(input.activityValue, factor.kgCO2ePerUnit);
        break;

      case 'SCOPE2_ELECTRICITY': {
        tCO2e = calculateElectricityLocationBased(input.activityValue, factor.kgCO2ePerUnit);
        const market = calculateElectricityMarketBased(
          input.activityValue,
          factor.kgCO2ePerUnit,
          input.isREGOBacked ?? false,
        );
        tCO2eMarketBased = market.tCO2e;
        break;
      }

      default:
        // Universal formula covers all Scope 3 categories (freight, waste,
        // ingredients, business travel) and any future categories.
        // activityData × kgCO2ePerUnit / 1000 = tCO2e
        tCO2e = (input.activityValue * factor.kgCO2ePerUnit) / 1000;
    }
  } catch (err) {
    if (err instanceof CalculationInputError) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: err.message });
    }
    throw err;
  }

  return { tCO2e, tCO2eMarketBased, factor, categoryId: category.id };
}

export const emissionsRouter = router({
  /**
   * Resolves the emission factor and returns the calculated tCO₂e without
   * writing anything to the database. Call this on form input change to power
   * the live CO₂e preview. Safe to call repeatedly — fully read-only.
   */
  calculateAndPreview: publicProcedure
    .input(EmissionEntryFormInputSchema)
    .query(async ({ ctx, input }) => {
      const { tCO2e, tCO2eMarketBased, factor } = await resolveAndCalculate(ctx.prisma, input);
      return { tCO2e, tCO2eMarketBased, factor };
    }),

  /**
   * Runs the full calculation and persists the EmissionEntry with tCO₂e and
   * emissionFactorId locked to the record. The factor is resolved at period end
   * date so historical records always reference the correct versioned factor.
   * Rejects writes if the reporting period is locked.
   */
  createEntry: publicProcedure
    .input(EmissionEntryFormInputSchema)
    .mutation(async ({ ctx, input }) => {
      await assertPeriodOpen(ctx.prisma, input.reportingPeriodId);
      const { tCO2e, tCO2eMarketBased, factor, categoryId } = await resolveAndCalculate(
        ctx.prisma,
        input,
      );
      return ctx.prisma.emissionEntry.create({
        data: {
          locationId: input.locationId,
          reportingPeriodId: input.reportingPeriodId,
          categoryId,
          enteredById: input.enteredById,
          emissionFactorId: factor.id,
          activityValue: input.activityValue,
          unit: input.unit,
          tCO2e,
          tCO2eMarketBased,
          notes: input.notes,
          status: input.status,
          dataSource: input.dataSource,
          dataQuality: input.dataQuality,
          evidenceRef: input.evidenceRef,
          supplierName: input.supplierName,
          isREGOBacked: input.isREGOBacked,
        },
        include: { category: true, emissionFactor: true },
      });
    }),

  listByLocation: publicProcedure
    .input(z.object({ locationId: z.string(), reportingPeriodId: z.string() }))
    .query(({ ctx, input }) =>
      ctx.prisma.emissionEntry.findMany({
        where: {
          locationId: input.locationId,
          reportingPeriodId: input.reportingPeriodId,
        },
        include: { category: true, emissionFactor: true },
        orderBy: { createdAt: 'asc' },
      }),
    ),

  byId: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(({ ctx, input }) =>
      ctx.prisma.emissionEntry.findUniqueOrThrow({
        where: { id: input.id },
        include: { category: true, emissionFactor: true, location: true },
      }),
    ),

  create: publicProcedure
    .input(CreateEmissionEntrySchema)
    .mutation(async ({ ctx, input }) => {
      await assertPeriodOpen(ctx.prisma, input.reportingPeriodId);
      return ctx.prisma.emissionEntry.create({ data: input });
    }),

  update: publicProcedure
    .input(UpdateEmissionEntrySchema)
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      const entry = await ctx.prisma.emissionEntry.findUniqueOrThrow({ where: { id } });
      await assertPeriodOpen(ctx.prisma, entry.reportingPeriodId);
      return ctx.prisma.emissionEntry.update({ where: { id }, data });
    }),

  delete: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const entry = await ctx.prisma.emissionEntry.findUniqueOrThrow({
        where: { id: input.id },
      });
      await assertPeriodOpen(ctx.prisma, entry.reportingPeriodId);
      return ctx.prisma.emissionEntry.delete({ where: { id: input.id } });
    }),
});
