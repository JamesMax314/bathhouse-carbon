import { z } from 'zod';
import { router, publicProcedure, TRPCError } from '../trpc';
import {
  CreateEmissionEntrySchema,
  UpdateEmissionEntrySchema,
} from '@/schemas/emission-entry';

async function assertPeriodOpen(
  prisma: Parameters<Parameters<typeof publicProcedure.mutation>[0]>[0]['ctx']['prisma'],
  reportingPeriodId: string,
) {
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

export const emissionsRouter = router({
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
