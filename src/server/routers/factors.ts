import { z } from 'zod';
import { router, publicProcedure } from '../trpc';

export const factorsRouter = router({
  listByCategory: publicProcedure
    .input(z.object({ categoryId: z.string() }))
    .query(({ ctx, input }) =>
      ctx.prisma.emissionFactor.findMany({
        where: { categoryId: input.categoryId },
        orderBy: { effectiveFrom: 'desc' },
      }),
    ),

  activeForDate: publicProcedure
    .input(z.object({ categoryId: z.string(), date: z.date() }))
    .query(({ ctx, input }) =>
      ctx.prisma.emissionFactor.findFirst({
        where: {
          categoryId: input.categoryId,
          effectiveFrom: { lte: input.date },
          OR: [{ effectiveTo: null }, { effectiveTo: { gte: input.date } }],
        },
        orderBy: { effectiveFrom: 'desc' },
      }),
    ),
});
