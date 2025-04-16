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

/**
 * Get file path information for Ollama vision API
 * Instead of converting to base64, this returns the filename as a path
 * 
 * @param file File to get path information from
 * @param uploadDir Optional directory path (default 'uploads/')
 * @returns Object containing file path and name
 */
export function getImageFilePath(file: File, uploadDir: string = 'uploads/'): { path: string, name: string } {
  // Get just the filename
  const fileName = file.name;
  
  // Create path that Ollama would use to access the file
  const filePath = `${uploadDir}/${fileName}`;
  
  console.log(`[getImageFilePath] Using file path: ${filePath} for ${fileName}`);
  
  return {
    path: filePath,
    name: fileName
  };
} 