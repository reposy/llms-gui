/**
 * Checks if a given string is a valid URL.
 * @param urlString The string to validate.
 * @returns True if the string is a valid URL, false otherwise.
 */
export const isValidUrl = (urlString: string): boolean => {
  if (!urlString) {
    return false;
  }
  try {
    // Use the URL constructor to validate
    // It throws an error if the URL is invalid
    new URL(urlString);
    return true;
  } catch (e) {
    // Check if it might be a relative URL (doesn't start with a protocol)
    // Basic check: doesn't contain common invalid characters and has some structure
    if (!urlString.startsWith('http://') && !urlString.startsWith('https://')) {
      // Allow simple paths like /api/users or relative paths like ../data
      // Avoid overly complex regex; this is a basic sanity check
      if (/^[a-zA-Z0-9\/\.\-_~%\?#=&]+$/.test(urlString)) {
        // Potentially allow relative URLs if needed, otherwise return false
        // For now, let's assume we only want absolute URLs
        // return true; 
        return false; // Uncomment above and comment this line to allow relative URLs
      }
    }
    return false;
  }
}; 