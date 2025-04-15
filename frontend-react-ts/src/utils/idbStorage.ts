import { openDB, DBSchema } from 'idb';
import { PersistStorage } from 'zustand/middleware';

/**
 * Interface defining our database schema
 */
interface LlmsGuiDBSchema extends DBSchema {
  'zustand-store': {
    key: string;
    value: string;
  };
}

/**
 * Creates a storage object compatible with Zustand's persist middleware
 * that uses IndexedDB as the underlying storage mechanism.
 * 
 * @returns A storage object compatible with Zustand's PersistStorage interface
 */
export const createIDBStorage = <T>(): PersistStorage<T> => {
  // Database connection variables
  const DB_NAME = 'llms-gui-db';
  const STORE_NAME = 'zustand-store';
  const DB_VERSION = 1;

  // Initialize database lazily on first operation
  const dbPromise = openDB<LlmsGuiDBSchema>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      console.log(`[idbStorage] Creating object store: ${STORE_NAME}`);
      db.createObjectStore(STORE_NAME);
    },
  });

  // Return a storage object that's compatible with Zustand's persistence API
  return {
    /**
     * Gets an item from IndexedDB
     * @param key The key to retrieve
     * @returns A promise that resolves to the stored value or null
     */
    getItem: async (key: string): Promise<T | null> => {
      try {
        console.log(`[idbStorage] Getting item: ${key}`);
        const db = await dbPromise;
        const value = await db.get(STORE_NAME, key);
        
        if (value === undefined || value === null) {
          return null;
        }
        
        return JSON.parse(value) as T;
      } catch (error) {
        console.error(`[idbStorage] Error getting item ${key}:`, error);
        return null;
      }
    },

    /**
     * Sets an item in IndexedDB
     * @param key The key to set
     * @param value The value to store
     * @returns A promise that resolves when the operation is complete
     */
    setItem: async (key: string, value: T): Promise<void> => {
      try {
        const valueString = JSON.stringify(value);
        console.log(`[idbStorage] Setting item: ${key} (${Math.round(valueString.length / 1024)} KB)`);
        const db = await dbPromise;
        await db.put(STORE_NAME, valueString, key);
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