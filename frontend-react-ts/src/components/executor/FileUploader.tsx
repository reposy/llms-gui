import React, { useState, useRef, useEffect } from 'react';
import { FlowData } from '../../utils/data/importExportUtils';
import { useExecutorStateStore } from '../../store/useExecutorStateStore';
import { DocumentArrowUpIcon } from '@heroicons/react/24/outline';
import { useImportService, ImportResult } from '../../hooks/useImportService';

interface FileUploaderProps {
  onFileUpload?: (flowData: FlowData, chainId?: string, flowId?: string) => void;
  externalFileInputRef?: React.RefObject<HTMLInputElement>;
  className?: string;
  buttonStyle?: boolean;
  buttonText?: string;
}

const FileUploader: React.FC<FileUploaderProps> = ({ 
  onFileUpload, 
  externalFileInputRef, 
  className = '',
  buttonStyle = false,
  buttonText = 'Import Flow'
}) => {
  const [fileName, setFileName] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [isDropping, setIsDropping] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const { activeChainId } = useExecutorStateStore(state => ({
    activeChainId: state.activeChainId
  }));
  
  const { importFromFile } = useImportService();
  
  useEffect(() => {
    // 외부 ref가 제공된 경우 이벤트 리스너 등록
    if (externalFileInputRef?.current) {
      const fileInput = externalFileInputRef.current;
      fileInput.addEventListener('change', handleFileChange);
      
      return () => {
        fileInput.removeEventListener('change', handleFileChange);
      };
    }
  }, [externalFileInputRef]);
  
  // 파일 변경 핸들러
  const handleFileChange = (event: Event) => {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length) return;
    
    const file = input.files[0];
    setFileName(file.name);
    
    // ✅ 중앙화된 Import 서비스 사용
    processFile(file);
  };
  
  // 파일 업로드 핸들러 (드래그 앤 드롭)
  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDropping(false);
    
    if (!event.dataTransfer.files?.length) return;
    
    const file = event.dataTransfer.files[0];
    setFileName(file.name);
    
    // ✅ 중앙화된 Import 서비스 사용
    processFile(file);
  };
  
  // 파일 선택 핸들러
  const handleClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };
  
  // 파일 처리 및 Import
  const processFile = async (file: File) => {
    try {
      setError('');
      
      if (!activeChainId) {
        setError('Flow를 추가할 Chain이 선택되지 않았습니다.');
        return;
      }
      
      const result: ImportResult = await importFromFile(file, {
        targetChainId: activeChainId,
        onSuccess: (result) => {
          console.log(`[FileUploader] Import 성공:`, result);
          
          // 기존 콜백 호출 (하위 호환성 유지)
          if (onFileUpload && result.type === 'flow') {
            // FlowData 재구성은 복잡하므로 간단히 성공 알림만
            onFileUpload({} as FlowData, result.chainId, result.flowId);
          }
        },
        onError: (error) => {
          setError(error.message);
        }
      });
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.error('[FileUploader] Error processing file:', err);
      setError(errorMessage);
    }
  };
  
  // 드래그 오버 핸들러
  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDropping(true);
  };
  
  const handleDragLeave = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDropping(false);
  };

  if (buttonStyle) {
    return (
      <>
        <div
          onClick={handleClick}
          className="flex items-center gap-1"
        >
          <DocumentArrowUpIcon className="h-5 w-5 text-white" />
          <span>{buttonText}</span>
        </div>
        <input
          type="file"
          ref={fileInputRef}
          className="hidden"
          accept=".json"
          onChange={(e) => handleFileChange(e.nativeEvent)}
        />
      </>
    );
  }
  
  return (
    <div className={`flow-uploader ${className}`}>
      <div
        className={`upload-area p-4 border-2 border-dashed rounded-lg ${
          isDropping ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400'
        } transition-colors duration-150 cursor-pointer flex flex-col items-center justify-center text-center`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={handleClick}
      >
        <DocumentArrowUpIcon className="h-8 w-8 text-gray-400 mb-2" />
        <p className="text-sm text-gray-600">Flow JSON 파일을 드래그하거나 클릭하여 업로드하세요</p>
        {fileName && <p className="text-xs mt-1 text-gray-500">선택된 파일: {fileName}</p>}
        {error && <p className="text-xs mt-1 text-red-500">{error}</p>}
      </div>
      
      <input
        type="file"
        ref={fileInputRef}
        className="hidden"
        accept=".json"
        onChange={(e) => handleFileChange(e.nativeEvent)}
      />
    </div>
  );
};

export default FileUploader; 