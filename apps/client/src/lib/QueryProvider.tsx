import { useState, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { httpBatchLink } from '@trpc/client';
import { authHeaders, trpc, TRPC_URL } from './trpc';

export default function QueryProvider({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            retry: 1,
            // Always attempt fetches and surface real error states instead of
            // pausing indefinitely when the browser's online heuristic misfires
            // (e.g. a dev-proxy connection failure looks like "offline").
            networkMode: 'always',
          },
          mutations: {
            networkMode: 'always',
          },
        },
      }),
  );

  const [client] = useState(() =>
    trpc.createClient({
      links: [httpBatchLink({ url: TRPC_URL, headers: authHeaders })],
    }),
  );

  return (
    <trpc.Provider client={client} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </trpc.Provider>
  );
}
