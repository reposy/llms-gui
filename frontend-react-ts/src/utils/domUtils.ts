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
 * Generates a robust CSS selector for a given element using tag names and :nth-child().
 * Creates a path like html > body > div:nth-child(1) > p:nth-child(3)
 * @param element The target DOM element.
 * @returns A generated CSS selector string representing the path, or an empty string if generation fails.
 */
export const generateSelector = (element: Element | null): string => {
  if (!element) return "";

  const pathParts: string[] = [];
  let currentElement: Element | null = element;

  while (currentElement) {
    const tagName = safeGetTagName(currentElement);
    if (!tagName) break; 

    let part = tagName;
    const parent = currentElement.parentElement;

    // Calculate :nth-child() if it has a parent and is not the html element itself
    if (parent && tagName !== 'html') {
      // Get all element children of the parent
      const siblings = Array.from(parent.children);
      let nthIndex = -1;
      // Find the index of the current element among its siblings
      for(let i = 0; i < siblings.length; i++) {
          if (siblings[i] === currentElement) {
              nthIndex = i + 1; // :nth-child is 1-based
              break;
          }
      }
      if (nthIndex > 0) {
        part = `${part}:nth-child(${nthIndex})`;
      } 
      // else: Something went wrong finding the element among siblings, fallback to just tag
    }

    pathParts.push(part);

    if (tagName === 'html') break; 
    currentElement = parent; // Move up to the parent
  }

  // Reverse the array and join with ' > ' 
  if (pathParts.length === 0) return "";
  return pathParts.reverse().join(' > ');
}; 