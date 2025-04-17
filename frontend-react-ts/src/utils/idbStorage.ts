import { openDB, DBSchema } from 'idb';
import { StateStorage, StorageValue } from 'zustand/middleware';

/**
 * Interface defining our database schema
 */
interface LlmsGuiDBSchema extends DBSchema {
  'zustand-store': {
    key: string;
    value: string; // Store values as strings
  };
}

/**
 * Creates a storage object compatible with Zustand's persist middleware
 * that uses IndexedDB as the underlying storage mechanism.
 * 
 * This version aligns with the `StateStorage` type expected by `persist`.
 * 
 * @returns A storage object compatible with Zustand's StateStorage interface
 */
export const createIDBStorage = (): StateStorage => {
  // Database connection variables
  const DB_NAME = 'llms-gui-db';
  const STORE_NAME = 'zustand-store';
  const DB_VERSION = 1;

  // Initialize database lazily on first operation
  const dbPromise = openDB<LlmsGuiDBSchema>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      console.log(`[idbStorage] Creating object store: ${STORE_NAME}`);
      // Ensure the store exists
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    },
  });

  // Return a storage object that's compatible with Zustand's persistence API
  return {
    /**
     * Gets an item from IndexedDB, returning it as a string or null.
     * @param key The key to retrieve
     * @returns A promise that resolves to the stored string value or null
     */
    getItem: async (key: string): Promise<string | null> => {
      try {
        console.log(`[idbStorage] Getting item: ${key}`);
        const db = await dbPromise;
        const value = await db.get(STORE_NAME, key);
        return value === undefined ? null : value;
      } catch (error) {
        console.error(`[idbStorage] Error getting item ${key}:`, error);
        return null;
      }
    },

    /**
     * Sets an item in IndexedDB. The value must be a string.
     * @param key The key to set
     * @param value The string value to store
     * @returns A promise that resolves when the operation is complete
     */
    setItem: async (key: string, value: string): Promise<void> => {
      // Runtime check: Ensure the value is a string before attempting to store.
      if (typeof value !== 'string') {
        console.error(`[idbStorage] setItem error: Value for key "${key}" must be a string, but received type ${typeof value}. Value:`, value);
        // Throw an error to prevent storing invalid data
        throw new TypeError(`[idbStorage] Value for key "${key}" must be a string.`);
      }
      try {
        console.log(`[idbStorage] Setting item: ${key} (${Math.round(value.length / 1024)} KB)`);
        const db = await dbPromise;
        await db.put(STORE_NAME, value, key);
      } catch (error) {
        console.error(`[idbStorage] Error setting item ${key}:`, error);
      }
    },

    /**
     * Removes an item from IndexedDB
     * @param key The key to remove
     * @returns A promise that resolves when the operation is complete
     */
    removeItem: async (key: string): Promise<void> => {
      try {
        console.log(`[idbStorage] Removing item: ${key}`);
        const db = await dbPromise;
        await db.delete(STORE_NAME, key);
      } catch (error) {
        console.error(`[idbStorage] Error removing item ${key}:`, error);
      }
    }
  };
}; 