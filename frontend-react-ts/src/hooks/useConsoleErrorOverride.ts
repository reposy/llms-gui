import { useEffect } from 'react';

interface ErrorOverrideOptions {
  suppressPatterns?: string[];
  replacementMessage?: string;
  logLevel?: 'warn' | 'info' | 'log' | 'debug' | 'error';
}

/**
 * Custom hook to override console.error and filter out specific error patterns
 * 
 * @param options Configuration options for error suppression
 * @returns void
 */
export function useConsoleErrorOverride(options: ErrorOverrideOptions = {}) {
  useEffect(() => {
    // Default patterns to suppress (React Flow related errors)
    const defaultPatterns = [
      "Couldn't create edge for target handle id",
      "Cannot read properties of null (reading 'getBoundingClientRect')",
      "Cannot read properties of undefined (reading 'getBoundingClientRect')"
    ];

    // Use provided patterns or defaults
    const patterns = options.suppressPatterns || defaultPatterns;
    const message = options.replacementMessage || "[Error Suppressed] Filtered out known error";
    const logLevel = options.logLevel || 'warn';

    // Store original console.error
    const originalError = console.error;
    
    // Create a wrapped version of console.error that filters known errors
    function wrappedConsoleError(...args: any[]) {
      // Convert first argument to string for pattern matching
      const errorMessage = args[0]?.toString() || '';
      
      // Check if the error matches any of our suppression patterns
      const shouldSuppress = patterns.some(pattern => errorMessage.includes(pattern));
      
      if (shouldSuppress) {
        // Log a less obtrusive message instead
        console[logLevel](`${message}: "${errorMessage.substring(0, 100)}..."`);
        return;
      }
      
      // Pass through all other errors to the original function
      originalError.apply(console, args);
    }
    
    // Override console.error with our wrapped version
    console.error = wrappedConsoleError;
    
    // Clean up when component unmounts
    return () => {
      console.error = originalError;
    };
  }, [options.suppressPatterns, options.replacementMessage, options.logLevel]);
} 