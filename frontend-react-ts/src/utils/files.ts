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
        
        // 결과 검증
        if (!result) {
          reject(new Error('File conversion resulted in empty data'));
          return;
        }
        
        // If we want the raw base64 string without the data URL prefix
        if (!returnDataUrl && result.startsWith('data:')) {
          // Strip the data URL prefix to get just the base64 part
          const base64Match = result.match(/^data:[^;]+;base64,(.*)$/);
          if (!base64Match) {
            reject(new Error('Invalid data URL format'));
            return;
          }
          
          const base64Data = base64Match[1];
          
          // Base64 유효성 검사
          if (!isValidBase64(base64Data)) {
            console.warn('Converted base64 data may be invalid, returning anyway');
          }
          
          resolve(base64Data);
        } else {
          // Return the full data URL
          resolve(result);
        }
      } catch (error) {
        console.error('Error in convertFileToBase64:', error);
        reject(new Error(`Error processing the file: ${error}`));
      }
    };
    
    reader.onerror = (error) => {
      console.error('FileReader error:', error);
      reject(new Error(`Failed to read the file: ${error}`));
    };
    
    try {
      reader.readAsDataURL(file);
    } catch (error) {
      console.error('Error calling readAsDataURL:', error);
      reject(new Error(`Failed to start reading file: ${error}`));
    }
  });
}

/**
 * Check if a string is valid base64 format
 * @param str String to check
 * @returns boolean indicating if string is valid base64
 */
export function isValidBase64(str: string): boolean {
  // Regular expression for valid base64 format
  const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/;
  
  // Should be a string with a reasonable length
  if (typeof str !== 'string' || str.length < 4) {
    return false;
  }
  
  // Base64 strings have a length that is a multiple of 4 (with possible padding)
  // and must match the regex pattern
  return base64Regex.test(str);
}

/**
 * Check if a file is an image based on its MIME type
 * @param file File to check
 * @returns boolean indicating if file is an image
 */
export function isImageFile(file: File): boolean {
  return file.type.startsWith('image/');
}

/**
 * Check if a file is a text file based on MIME type or extension
 * @param file File to check
 * @returns boolean indicating if file is a text file
 */
export function isTextFile(file: File): boolean {
  // Check MIME type first
  if (file.type.startsWith('text/')) {
    return true;
  }
  
  // Check common text file extensions
  const textExtensions = ['.txt', '.csv', '.md', '.json', '.js', '.ts', '.html', '.css', '.xml', '.yml', '.yaml'];
  const fileName = file.name.toLowerCase();
  return textExtensions.some(ext => fileName.endsWith(ext));
}

/**
 * Check if a file is unsupported (PDF, Word, zip, binaries, etc.)
 * @param file File to check
 * @returns boolean indicating if file is unsupported
 */
export function isUnsupportedFile(file: File): boolean {
  // Known unsupported MIME types
  const unsupportedMimes = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/x-zip-compressed',
    'application/zip',
    'application/x-7z-compressed',
    'application/x-msdownload',
    'application/x-debian-package',
    'application/vnd.android.package-archive',
    'application/x-apple-diskimage',
    'application/octet-stream'
  ];
  
  if (unsupportedMimes.includes(file.type)) {
    return true;
  }
  
  // Check for unsupported extensions
  const unsupportedExtensions = [
    '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
    '.zip', '.7z', '.rar', '.tar', '.gz', '.exe', '.bin', '.apk', '.dmg'
  ];
  
  const fileName = file.name.toLowerCase();
  return unsupportedExtensions.some(ext => fileName.endsWith(ext));
}

/**
 * Read a text file and return its contents
 * @param file Text file to read
 * @returns Promise with the text content
 */
export async function readTextFile(file: File): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = () => {
      try {
        resolve(reader.result as string);
      } catch (error) {
        reject(new Error(`Error reading text file: ${error}`));
      }
    };
    
    reader.onerror = () => {
      reject(new Error('Failed to read the text file'));
    };
    
    reader.readAsText(file);
  });
} 