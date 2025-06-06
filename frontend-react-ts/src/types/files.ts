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
 * 백엔드 통합 파일 메타데이터 - 새로운 표준 구조
 * 사용자 제안: {fileId, originalFileName, filePath}
 */
export interface UnifiedFileMetadata {
  fileId: string;           // UUID
  originalFileName: string; // 원본 파일명
  filePath: string;         // 컨텍스트 (flow_executor, flow_editor 등)
}

/**
 * 백엔드에서 반환되는 전체 파일 메타데이터
 */
export interface BackendFileMetadata extends UnifiedFileMetadata {
  backendPath: string;      // 실제 백엔드 저장 경로
  url: string;              // 접근 가능한 URL 경로
  contentType: string;      // 파일 MIME 타입
  size: number;             // 파일 크기 (바이트)
  uploadedAt: number;       // 업로드된 시간 (Unix timestamp)
}

/**
 * 파일 업로드 컨텍스트 정의
 */
export const FILE_CONTEXTS = {
  FLOW_EXECUTOR: 'flow_executor',
  FLOW_EDITOR: 'flow_editor',
  INPUT_NODE: 'input_node',
  DEFAULT: 'default'
} as const;

export type FileContext = typeof FILE_CONTEXTS[keyof typeof FILE_CONTEXTS];

/**
 * API 기본 URL 설정
 */
export const API_BASE_URL = 'http://localhost:8000';

/**
 * 파일이 이미지인지 확인
 * @param file 파일 메타데이터 또는 File 객체
 * @returns 이미지 여부
 */
export function isImageFile(file: BackendFileMetadata | FileMetadata | File | LocalFileMetadata): boolean {
  if ('contentType' in file) {
    return file.contentType.startsWith('image/');
  } else if ('type' in file) {
    return file.type.startsWith('image/');
  }
  return false;
}

/**
 * MIME 타입 추정
 * @param fileName 파일명
 * @returns 추측된 MIME 타입
 */
export function guessMimeType(fileName: string): string {
  const ext = fileName.toLowerCase().split('.').pop();
  const mimeMap: Record<string, string> = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    gif: 'image/gif',
    webp: 'image/webp',
    svg: 'image/svg+xml',
    bmp: 'image/bmp',
    tiff: 'image/tiff'
  };
  return mimeMap[ext || ''] || 'application/octet-stream';
}

/**
 * 파일 크기를 읽기 쉬운 형식으로 변환
 * @param bytes 바이트 단위 크기
 * @returns 읽기 쉬운 크기 문자열 (예: "1.5 MB")
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * 파일 크기 제한 확인
 * @param file 파일 객체 또는 메타데이터
 * @param maxSize 최대 크기 (바이트 단위, 기본값 10MB)
 * @returns 크기 제한 내 여부
 */
export function isFileSizeValid(file: File | BackendFileMetadata | FileMetadata | LocalFileMetadata, maxSize: number = 10 * 1024 * 1024): boolean {
  const size = 'size' in file ? file.size : 0;
  return size > 0 && size <= maxSize;
}

/**
 * 전체 파일 URL 생성
 * @param metadata 파일 메타데이터
 * @returns 완전한 URL
 */
export function getFullFileUrl(metadata: FileMetadata): string {
  return `${API_BASE_URL}${metadata.url}`;
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