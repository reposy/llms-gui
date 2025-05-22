import React, { useRef, useEffect, useState, useCallback } from 'react';

interface FileSelectorProps {
  /**
   * 파일이 선택되었을 때 호출되는 콜백 함수
   */
  onFileSelected: (file: File) => void;
  
  /**
   * 허용되는 파일 확장자 (예: '.json')
   */
  accept?: string;
  
  /**
   * 버튼 텍스트
   */
  buttonText?: string;
  
  /**
   * 외부에서 파일 선택기를 조작하기 위한 ref
   */
  fileSelectorRef?: React.RefObject<{ openFileSelector: () => void }>;
  
  /**
   * 버튼 스타일 클래스
   */
  buttonClassName?: string;
  
  /**
   * 파일 선택 시 자동 업로드 여부
   */
  autoUpload?: boolean;
}

/**
 * 파일 선택 컴포넌트
 * 
 * 파일 선택 대화상자를 표시하고 선택된 파일을 처리하는 재사용 가능한 컴포넌트입니다.
 */
const FileSelector: React.FC<FileSelectorProps> = ({
  onFileSelected,
  accept = '*',
  buttonText = '파일 선택',
  fileSelectorRef,
  buttonClassName = 'px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors flex items-center',
  autoUpload = true
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFileName, setSelectedFileName] = useState<string>('');
  
  // 파일 선택기 열기 함수
  const openFileSelector = useCallback(() => {
    fileInputRef.current?.click();
  }, []);
  
  // 외부 ref 연결
  useEffect(() => {
    if (fileSelectorRef) {
      (fileSelectorRef as any).current = {
        openFileSelector
      };
    }
  }, [fileSelectorRef, openFileSelector]);
  
  // 파일 변경 처리 핸들러
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;
    
    const file = files[0];
    setSelectedFileName(file.name);
    
    // 외부 콜백 호출
    if (autoUpload) {
      onFileSelected(file);
    }
    
    // 파일 선택 대화상자 초기화 (같은 파일 다시 선택 가능하도록)
    event.target.value = '';
  };
  
  return (
    <div className="file-selector">
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept={accept}
        className="hidden"
        style={{ display: 'none' }}
      />
      <button
        onClick={openFileSelector}
        className={buttonClassName}
        type="button"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" />
        </svg>
        {buttonText}
      </button>
    </div>
  );
};

export default FileSelector; 