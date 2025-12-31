import type { Persister, PersistedClient } from '@tanstack/query-persist-client-core';

const STORAGE_KEY = 'din-query-cache';

/**
 * Custom async localStorage persister for React Query
 * Handles serialization/deserialization and error handling
 */
export const asyncStoragePersister: Persister = {
  persistClient: async (persistedClient: PersistedClient): Promise<void> => {
    try {
      const serialized = JSON.stringify(persistedClient);
      localStorage.setItem(STORAGE_KEY, serialized);
    } catch (error) {
      // Handle quota exceeded error
      if (error instanceof DOMException && error.name === 'QuotaExceededError') {
        console.warn('localStorage quota exceeded. Clearing old cache...');
        // Try to clear old cache entries (keep only recent ones)
        try {
          const keys = Object.keys(localStorage);
          const queryKeys = keys.filter(k => k.startsWith('din-query-cache') || k.startsWith('tanstack-query'));
          // Remove oldest entries (simple approach: remove first half)
          queryKeys.slice(0, Math.floor(queryKeys.length / 2)).forEach(k => {
            localStorage.removeItem(k);
          });
          // Retry setting the item
          localStorage.setItem(STORAGE_KEY, JSON.stringify(persistedClient));
        } catch (retryError) {
          console.error('Failed to clear cache and retry:', retryError);
          throw error;
        }
      } else {
        console.error('Failed to persist query client:', error);
        throw error;
      }
    }
  },

  restoreClient: async (): Promise<PersistedClient | undefined> => {
    try {
      const cached = localStorage.getItem(STORAGE_KEY);
      if (!cached) {
        return undefined;
      }
      return JSON.parse(cached) as PersistedClient;
    } catch (error) {
      console.warn('Failed to restore query client from cache:', error);
      // If restoration fails, remove the corrupted cache
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch (removeError) {
        console.error('Failed to remove corrupted cache:', removeError);
      }
      return undefined;
    }
  },

  removeClient: async (): Promise<void> => {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (error) {
      console.warn('Failed to remove query client from cache:', error);
    }
  },
};

