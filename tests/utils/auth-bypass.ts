/**
 * Utilities to bypass authentication for testing
 * This creates a mock session that the server will accept
 */

export interface TestUser {
    id: string;
    email?: string;
    name?: string;
}

export const TEST_USER: TestUser = {
    id: 'test-user-123',
    email: 'test@example.com',
    name: 'Test User'
};

/**
 * Create headers with a mock session cookie
 * In a real implementation, you'd need to create a valid session token
 * For now, we'll use a special test mode header
 */
export function createTestHeaders(user: TestUser = TEST_USER): Headers {
    const headers = new Headers();
    // Add a special test header that the server can recognize
    headers.set('X-Test-User-Id', user.id);
    headers.set('X-Test-Mode', 'true');
    return headers;
}

/**
 * Create a fetch function that includes test auth headers
 */
export function createTestFetch(baseUrl: string, user?: TestUser) {
    return async (path: string, options: RequestInit = {}) => {
        const url = `${baseUrl}${path}`;
        const headers = new Headers(options.headers);
        const testHeaders = createTestHeaders(user);
        
        // Merge test headers
        testHeaders.forEach((value, key) => {
            headers.set(key, value);
        });

        return fetch(url, {
            ...options,
            headers
        });
    };
}

