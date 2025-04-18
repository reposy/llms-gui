/**
 * 데이터를 파일로 다운로드하는 유틸리티 함수
 * @param content 다운로드할 콘텐츠
 * @param filename 파일 이름
 * @param mimeType MIME 타입 (기본값: text/plain)
 */
export const downloadFile = (
  content: string,
  filename: string,
  mimeType: string = 'text/plain'
): void => {
  // Blob 객체 생성
  const blob = new Blob([content], { type: mimeType });
  
  // URL 생성
  const url = URL.createObjectURL(blob);
  
  // 다운로드 링크 생성
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  
  // 링크 클릭 시뮬레이션
  document.body.appendChild(link);
  link.click();
  
  // 정리
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}; 