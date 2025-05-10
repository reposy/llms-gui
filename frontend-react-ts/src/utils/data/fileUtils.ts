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
 * 파일을 Base64로 인코딩하여 데이터 URL 형식으로 반환
 * @param file 인코딩할 파일
 * @returns 데이터 URL 형식의 Base64 문자열 (data:mimetype;base64,...)
 */
export function readFileAsBase64(file: File): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    // 파일 유효성 검사
    if (!file) {
      reject(new Error('Invalid file: File is null or undefined'));
      return;
    }
    
    // 적절한 MIME 타입 확인
    const mimeType = file.type || 'application/octet-stream';
    
    // FileReader 설정
    const reader = new FileReader();
    
    reader.onload = () => {
      try {
        if (!reader.result) {
          reject(new Error('FileReader result is empty'));
          return;
        }
        
        // 결과가 이미 문자열인 경우 (dataURL)
        if (typeof reader.result === 'string') {
          // 유효한 데이터 URL 형식인지 확인
          if (reader.result.startsWith('data:') && reader.result.includes(';base64,')) {
            resolve(reader.result);
          } else {
            reject(new Error('FileReader did not return a valid data URL'));
          }
        } 
        // ArrayBuffer인 경우 (readAsArrayBuffer를 사용했을 때)
        else if (reader.result instanceof ArrayBuffer) {
          // ArrayBuffer를 Base64로 변환
          const binary = [];
          const bytes = new Uint8Array(reader.result);
          const len = bytes.byteLength;
          
          for (let i = 0; i < len; i++) {
            binary.push(String.fromCharCode(bytes[i]));
          }
          
          const base64 = btoa(binary.join(''));
          resolve(`data:${mimeType};base64,${base64}`);
        } else {
          reject(new Error('Unsupported FileReader result type'));
        }
      } catch (error: any) {
        reject(new Error(`Base64 encoding failed: ${error.message}`));
      }
    };
    
    reader.onerror = () => {
      reject(new Error('FileReader error: Failed to read the file'));
    };
    
    // 데이터 URL로 읽기 (Base64 포함)
    reader.readAsDataURL(file);
  });
}

/**
 * Filters an array of items and returns only the image File objects.
 * @param items An array potentially containing File objects and other types.
 * @returns An array containing only the image File objects.
 */
export function filterImageFiles(items: any[]): File[] {
  return items.filter((item): item is File => 
    item instanceof File && item.type.startsWith('image/')
  );
}

/**
 * Checks if a string ends with a common image file extension.
 * @param filename The string (presumably a filename or path) to check.
 * @returns True if the string ends with a known image extension, false otherwise.
 */
export function hasImageExtension(filename: string): boolean {
  if (typeof filename !== 'string') {
    return false;
  }
  return /\.(jpg|jpeg|png|gif|bmp|webp)$/i.test(filename);
}

/**
 * Get file path information for Ollama vision API
 * @deprecated This function might be misleading as Ollama library in browser needs Base64, not path.
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