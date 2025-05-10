/**
 * 파일 메타데이터를 정의하는 인터페이스
 * 백엔드에서 반환되는 파일 정보 구조와 일치
 */
export interface FileMetadata {
  id: string;              // 파일 고유 ID (UUID)
  originalName: string;    // 원본 파일명
  filename: string;        // 서버에 저장된 파일명
  path: string;            // 서버 내부 경로
  url: string;             // 접근 가능한 URL 경로
  contentType: string;     // 파일 MIME 타입
  size: number;            // 파일 크기 (바이트)
  uploadedAt: number;      // 업로드된 시간 (Unix timestamp)
}

/**
 * 클라이언트 측에서 메모리에 저장된 파일 메타데이터
 * 새로고침 시 데이터가 사라지는 임시 파일 참조를 위한 구조
 */
export interface LocalFileMetadata {
  id: string;              // 파일 고유 ID (UUID)
  originalName: string;    // 원본 파일명
  objectUrl: string;       // 브라우저 메모리 내 objectURL
  contentType: string;     // 파일 MIME 타입
  size: number;            // 파일 크기 (바이트)
  file: File;              // 실제 File 객체 참조
  uploadedAt: number;      // 업로드된 시간 (Unix timestamp)
}

/**
 * 백엔드 API 기본 URL 설정
 * FastAPI는 기본적으로 8000 포트에서 실행됨
 */
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

/**
 * 파일이 이미지인지 확인
 * @param file 파일 메타데이터 또는 File 객체
 * @returns 이미지 여부
 */
export function isImageFile(file: FileMetadata | File | LocalFileMetadata): boolean {
  if ('contentType' in file) {
    return file.contentType.startsWith('image/');
  } else if ('type' in file) {
    return file.type.startsWith('image/');
  }
  return false;
}

/**
 * 상대 URL을 완전한 URL로 변환
 * @param url 상대 또는 절대 URL
 * @returns 완전한 URL
 */
export function getFullFileUrl(url: string): string {
  // 이미 절대 URL인 경우 그대로 반환
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('blob:')) {
    return url;
  }
  
  // API 엔드포인트로 시작하는 경우, API_BASE_URL과 결합
  if (url.startsWith('/api/')) {
    return `${API_BASE_URL}${url}`;
  }
  
  // 그 외의 경우는 현재 도메인을 기준으로 URL 구성
  return new URL(url, window.location.origin).toString();
}

/**
 * 파일 크기를 사람이 읽기 쉬운 형식으로 변환
 * @param bytes 바이트 단위 크기
 * @returns 읽기 쉬운 크기 문자열 (예: "1.5 MB")
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

/**
 * 파일 확장자로부터 MIME 타입 추측
 * @param filename 파일명
 * @returns 추측된 MIME 타입
 */
export function guessMimeType(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase();
  const mimeTypes: {[key: string]: string} = {
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'png': 'image/png',
    'gif': 'image/gif',
    'webp': 'image/webp',
    'svg': 'image/svg+xml',
    'bmp': 'image/bmp',
    'tiff': 'image/tiff',
    'tif': 'image/tiff'
  };
  
  return ext && ext in mimeTypes ? mimeTypes[ext] : 'application/octet-stream';
}

/**
 * File 객체로부터 LocalFileMetadata 생성
 * @param file 파일 객체
 * @returns LocalFileMetadata 객체
 */
export function createLocalFileMetadata(file: File): LocalFileMetadata {
  return {
    id: crypto.randomUUID(), // 고유 ID 생성
    originalName: file.name,
    contentType: file.type || guessMimeType(file.name),
    size: file.size,
    file: file,
    objectUrl: URL.createObjectURL(file),
    uploadedAt: Date.now()
  };
}

/**
 * objectURL 해제
 * @param metadata 로컬 파일 메타데이터
 */
export function revokeObjectUrl(metadata: LocalFileMetadata | string): void {
  const url = typeof metadata === 'string' ? metadata : metadata.objectUrl;
  if (url && url.startsWith('blob:')) {
    URL.revokeObjectURL(url);
  }
}

/**
 * 파일 크기 제한 확인
 * @param file 파일 객체 또는 메타데이터
 * @param maxSize 최대 크기 (바이트 단위, 기본값 10MB)
 * @returns 크기 제한 내 여부
 */
export function isFileSizeValid(file: File | FileMetadata | LocalFileMetadata, maxSize: number = 10 * 1024 * 1024): boolean {
  const size = 'size' in file ? file.size : 0;
  return size > 0 && size <= maxSize;
} 