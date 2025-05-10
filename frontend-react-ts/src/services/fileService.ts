import { FileMetadata, getFullFileUrl, API_BASE_URL } from '../types/files';

/**
 * 파일을 서버에 업로드하고 메타데이터를 반환합니다.
 * @param file 업로드할 파일
 * @returns 파일 메타데이터
 * @throws 업로드 실패 시 에러
 */
export async function uploadFile(file: File): Promise<FileMetadata> {
  // 로컬 검증 - 이미지 타입 및 크기 확인
  if (!file.type.startsWith('image/')) {
    throw new Error(`Unsupported file type: ${file.type}. Only images are allowed.`);
  }
  
  const maxSize = 10 * 1024 * 1024; // 10MB
  if (file.size > maxSize) {
    throw new Error(`File too large: ${file.size} bytes. Maximum allowed size is ${maxSize} bytes (10MB).`);
  }
  
  // FormData 구성
  const formData = new FormData();
  formData.append('file', file);
  
  try {
    // 업로드 요청 (절대 URL 사용)
    const uploadUrl = `${API_BASE_URL}/api/files/upload`;
    console.log(`Uploading file to: ${uploadUrl}`);
    
    const response = await fetch(uploadUrl, {
      method: 'POST',
      body: formData
    });
    
    // 에러 처리
    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      const errorMessage = errorData?.detail || response.statusText || 'Upload failed';
      throw new Error(`File upload failed (${response.status}): ${errorMessage}`);
    }
    
    // 성공시 메타데이터 반환
    return await response.json();
  } catch (error) {
    console.error('File upload error:', error);
    throw error;
  }
}

/**
 * 업로드된 파일 목록을 가져옵니다.
 * @param limit 최대 파일 수
 * @returns 파일 메타데이터 배열
 */
export async function getFiles(limit: number = 100): Promise<FileMetadata[]> {
  try {
    const filesUrl = `${API_BASE_URL}/api/files?limit=${limit}`;
    const response = await fetch(filesUrl);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch files: ${response.statusText}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error fetching files:', error);
    return [];
  }
}

/**
 * 파일 URL이 유효한지 확인합니다.
 * @param url 파일 URL
 * @returns 유효 여부
 */
export async function validateFileUrl(url: string): Promise<boolean> {
  try {
    const fullUrl = getFullFileUrl(url);
    const response = await fetch(fullUrl, { method: 'HEAD' });
    return response.ok;
  } catch (error) {
    console.error('Error validating file URL:', error);
    return false;
  }
} 