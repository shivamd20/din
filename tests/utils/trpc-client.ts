import { createTRPCProxyClient, httpBatchLink } from '@trpc/client';
import type { AppRouter } from '../../server/trpc';
import { createTestHeaders, TEST_USER } from './auth-bypass';
import { getServerUrl } from '../setup';

// Re-export for convenience
export { TEST_USER } from './auth-bypass';

/**
 * Create a tRPC client for testing with auth bypass
 */
export function createTestTRPCClient(userId: string = TEST_USER.id) {
    const headers = createTestHeaders({ id: userId });
    
    return createTRPCProxyClient<AppRouter>({
        links: [
            httpBatchLink({
                url: `${getServerUrl()}/api/trpc`,
                headers: () => {
                    const h: Record<string, string> = {};
                    headers.forEach((value, key) => {
                        h[key] = value;
                    });
                    return h;
                },
            }),
        ],
    });
}

