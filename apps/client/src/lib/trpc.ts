import { createTRPCReact } from '@trpc/react-query';
import { createTRPCClient, httpBatchLink } from '@trpc/client';
import type { AppRouter } from '../../../server/src/router';
import { getAuthToken } from './authToken';

// In dev, relative '/trpc' goes through the Vite proxy to localhost:3001.
// In production, the client (Vercel) and server (Railway) are different
// origins, so VITE_API_URL must point at the deployed server's base URL.
//
// Trailing slashes are stripped: a base ending in '/' produced '//trpc', which
// Express does not match against its '/trpc' mount, so every call 404'd.
const API_BASE = (import.meta.env.VITE_API_URL ?? '').replace(/\/+$/, '');
export const TRPC_URL = `${API_BASE}/trpc`;

async function authHeaders() {
  const token = await getAuthToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export const trpc = createTRPCReact<AppRouter>();

export const trpcClient = createTRPCClient<AppRouter>({
  links: [httpBatchLink({ url: TRPC_URL, headers: authHeaders })],
});
