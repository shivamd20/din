import { createTRPCReact } from '@trpc/react-query';
import type { AppRouter } from '../../server/trpc';
import { httpBatchLink } from '@trpc/client';
import { QueryClient } from '@tanstack/react-query';
import { persistQueryClient } from '@tanstack/query-persist-client-core';
import { asyncStoragePersister } from './query-persistence';

export const trpc = createTRPCReact<AppRouter>();

// Configure QueryClient with offline-first settings
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: Infinity, // Treat cached data as fresh initially
      gcTime: 1000 * 60 * 60 * 24 * 7, // 7 days
      refetchOnMount: false, // Don't refetch on mount if we have data
      refetchOnWindowFocus: false, // Don't refetch on window focus
      refetchOnReconnect: true, // Refetch when network reconnects
      retry: 1, // Minimal retries for offline scenarios
      placeholderData: (previousData: unknown) => previousData, // Keep previous data while fetching
    },
  },
});

// Set up persistence
if (typeof window !== 'undefined') {
  // Type assertion needed due to nested dependency version mismatch
  persistQueryClient({
    queryClient: queryClient as any,
    persister: asyncStoragePersister,
    maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
  });
}

export const trpcClient = trpc.createClient({
    links: [
        httpBatchLink({
            url: '/api/trpc',
        }),
    ],
});
