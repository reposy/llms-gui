/**
 * Utilities for vision model functionality
 */

/**
 * Convert a file to base64 string
 * 
 * @param file File or Blob to convert
 * @returns Promise with the base64 string (without data URL prefix)
 */
export async function fileToBase64(file: File | Blob): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = () => {
      try {
        const result = reader.result as string;
        
        // Strip the data URL prefix to get just the base64 part
        const base64Match = result.match(/^data:[^;]+;base64,(.*)$/);
        if (!base64Match) {
          reject(new Error('Invalid data URL format'));
          return;
        }
        
        resolve(base64Match[1]);
      } catch (error) {
        console.error('Error in fileToBase64:', error);
        reject(error);
      }
    };
    
    reader.onerror = (error) => {
      reject(error);
    };
    
    reader.readAsDataURL(file);
  });
} 