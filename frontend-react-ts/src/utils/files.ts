/**
 * Convert a File or Blob to a base64 string
 * 
 * @param file File or Blob to convert
 * @param returnDataUrl If true, returns the complete data URL (data:mime/type;base64,...)
 * @returns Promise with base64 string or data URL
 */
export async function convertFileToBase64(file: File | Blob, returnDataUrl = false): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = () => {
      try {
        const result = reader.result as string;
        
        // If we want the raw base64 string without the data URL prefix
        if (!returnDataUrl && result.startsWith('data:')) {
          // Strip the data URL prefix to get just the base64 part
          const base64Data = result.split(',')[1];
          resolve(base64Data);
        } else {
          // Return the full data URL
          resolve(result);
        }
      } catch (error) {
        reject(new Error(`Error processing the file: ${error}`));
      }
    };
    
    reader.onerror = () => {
      reject(new Error('Failed to read the file'));
    };
    
    reader.readAsDataURL(file);
  });
} 