/**
 * Helper functions for safe DOM element access and manipulation.
 */

/**
 * Safely retrieves the lowercase tag name of an element.
 * @param element The DOM element.
 * @returns The lowercase tag name or an empty string if access fails.
 */
export const safeGetTagName = (element: Element | null): string => {
  if (!element) return "";
  try {
    if (element.tagName) {
      return element.tagName.toLowerCase();
    }
  } catch (e) {
    console.error("Error accessing tagName:", e);
  }
  return "";
};

/**
 * Safely retrieves the class list of an element as an array.
 * @param element The DOM element.
 * @returns An array of class names or an empty array if access fails.
 */
export const safeGetClassList = (element: Element | null): string[] => {
  if (!element) return [];
  try {
    if (element.classList) {
      return Array.from(element.classList);
    }
  } catch (e) {
    console.error("Error accessing classList:", e);
  }
  return [];
};

/**
 * Safely retrieves the children of an element as an array.
 * @param element The DOM element.
 * @returns An array of child elements or an empty array if access fails.
 */
export const safeGetChildren = (element: Element | null): Element[] => {
  if (!element) return [];
  try {
    if (element.children) {
      return Array.from(element.children);
    }
  } catch (e) {
    console.error("Error accessing children:", e);
  }
  return [];
};

/**
 * Generates a CSS selector for a given element (basic implementation).
 * Prefers ID, then falls back to tag name + classes.
 * @param element The DOM element.
 * @returns A generated CSS selector string, or an empty string if generation fails.
 */
export const generateSelector = (element: Element): string => {
  if (!element) return "";
  
  const tagName = safeGetTagName(element);
  if (!tagName) return "";
  
  let selector = tagName;
  
  // Prefer ID if available
  try {
    if (element.id) {
      // Basic check for valid CSS ID characters (simplified)
      if (/^[a-zA-Z0-9_-]+$/.test(element.id)) {
         selector = `${tagName}#${element.id}`;
         // Consider ID unique enough for this basic implementation
         return selector; 
      } else {
         console.warn(`Element ID "${element.id}" contains invalid characters for CSS selector, omitting ID.`);
      }
    }
  } catch (e) {
    console.error("Error accessing element ID:", e);
  }
  
  // Add classes if no suitable ID
  const classList = safeGetClassList(element);
  if (classList.length > 0) {
    // Filter potentially invalid class names (e.g., starting with a digit, though CSS4 allows it)
    const validClasses = classList.filter(cls => /^[a-zA-Z_-][a-zA-Z0-9_-]*$/.test(cls));
    if (validClasses.length > 0) {
        const classes = validClasses.join('.');
        selector = `${selector}.${classes}`;
    }
  }
  
  // Basic fallback to just tag name if no ID or valid classes
  return selector;
}; 