import { router, publicProcedure } from './trpc.js';
import { templatesRouter } from './routers/templates.js';
import { sessionsRouter } from './routers/sessions.js';
import { cycleRouter } from './routers/cycle.js';

export const appRouter = router({
  health: publicProcedure.query(() => ({ status: 'ok' })),
  templates: templatesRouter,
  sessions: sessionsRouter,
  cycle: cycleRouter,
});

export type AppRouter = typeof appRouter;
