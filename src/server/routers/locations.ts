import { z } from 'zod';
import { router, publicProcedure } from '../trpc';

export const locationsRouter = router({
  list: publicProcedure.query(({ ctx }) =>
    ctx.prisma.location.findMany({
      where: { isActive: true },
      orderBy: [{ type: 'asc' }, { name: 'asc' }],
    }),
  ),

  byId: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(({ ctx, input }) =>
      ctx.prisma.location.findUniqueOrThrow({ where: { id: input.id } }),
    ),
});
