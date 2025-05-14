/**
 * Utility helper functions for general purposes
 */

/**
 * Creates a deep copy of an object or array.
 * This ensures that all nested objects and arrays are cloned,
 * preventing shared references between the original and the copy.
 * 
 * @param obj The object or array to deep clone
 * @returns A deep copy of the input
 */
export const deepClone = <T>(obj: T): T => {
  // Handle primitive types, null, and undefined
  if (obj === null || obj === undefined || typeof obj !== 'object') {
    return obj;
  }
  
  // Handle Date objects
  if (obj instanceof Date) {
    return new Date(obj.getTime()) as unknown as T;
  }
  
  // Handle Array objects
  if (Array.isArray(obj)) {
    return obj.map(item => deepClone(item)) as unknown as T;
  }
  
  // Handle regular objects
  const clonedObj = {} as Record<string, any>;
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      clonedObj[key] = deepClone((obj as Record<string, any>)[key]);
    }
  }
  
  return clonedObj as T;
}; 