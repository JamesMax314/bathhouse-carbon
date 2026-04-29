import { router } from '../trpc';
import { locationsRouter } from './locations';
import { emissionsRouter } from './emissions';
import { factorsRouter } from './factors';

export const appRouter = router({
  locations: locationsRouter,
  emissions: emissionsRouter,
  factors: factorsRouter,
});

export type AppRouter = typeof appRouter;
