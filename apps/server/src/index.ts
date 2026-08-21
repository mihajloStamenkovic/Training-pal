import './env.js';
import express from 'express';
import cors from 'cors';
import { clerkMiddleware } from '@clerk/express';
import * as trpcExpress from '@trpc/server/adapters/express';
import { appRouter } from './router.js';
import { createContext } from './trpc.js';

const app = express();
const PORT = process.env.PORT ? Number(process.env.PORT) : 3001;

const allowedOrigins = [/^http:\/\/localhost:\d+$/, ...(process.env.CLIENT_ORIGIN?.split(',') ?? [])];
app.use(cors({ origin: allowedOrigins }));

// Kept clear of Clerk so it stays a pure liveness signal — a misconfigured
// auth key shouldn't make the server look down.
app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.use(
  '/trpc',
  clerkMiddleware(),
  trpcExpress.createExpressMiddleware({
    router: appRouter,
    createContext,
  }),
);

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
