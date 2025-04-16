/**
 * Throttle function to limit how often a function can be called
 * @param fn The function to throttle
 * @param delay The minimum time between function calls in milliseconds
 * @returns A throttled version of the function
 */
export function throttle<T extends (...args: any[]) => any>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let lastCall = 0;
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  let lastArgs: Parameters<T> | null = null;

  return function throttled(...args: Parameters<T>) {
    const now = Date.now();
    const timeSinceLastCall = now - lastCall;

    // Store the latest arguments
    lastArgs = args;

    // If enough time has passed since the last call, execute immediately
    if (timeSinceLastCall >= delay) {
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
      lastCall = now;
      return fn(...args);
    }

    // Otherwise, schedule to execute after delay has passed
    if (!timeoutId) {
      timeoutId = setTimeout(() => {
        lastCall = Date.now();
        timeoutId = null;
        if (lastArgs) {
          fn(...lastArgs);
          lastArgs = null;
        }
      }, delay - timeSinceLastCall);
    }
  };
}

/**
 * Debounce function to delay execution until after a period of inactivity
 * @param fn The function to debounce
 * @param delay The wait time in milliseconds
 * @returns A debounced version of the function with a cancel method
 */
export function debounce<T extends (...args: any[]) => any>(
  fn: T,
  delay: number
): {
  (...args: Parameters<T>): void;
  cancel: () => void;
} {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  // 반환할 debounced 함수
  function debounced(...args: Parameters<T>): void {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    timeoutId = setTimeout(() => {
      fn(...args);
      timeoutId = null;
    }, delay);
  }

  // cancel 메서드 추가
  debounced.cancel = (): void => {
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
  };

  return debounced;
} 