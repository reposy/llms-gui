import React, { useState, useRef, useEffect } from 'react';
import { FlowData } from '../../utils/data/importExportUtils';
import { useFlowExecutorStore } from '../../store/useFlowExecutorStore';
import { PlusIcon, DocumentArrowUpIcon } from '@heroicons/react/24/outline';

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
  
  const { addFlowToChain, activeChainId } = useFlowExecutorStore();
  
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
    
    // 파일 읽기
    readFile(file);
  };
  
  // 파일 업로드 핸들러 (드래그 앤 드롭)
  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDropping(false);
    
    if (!event.dataTransfer.files?.length) return;
    
    const file = event.dataTransfer.files[0];
    setFileName(file.name);
    
    // 파일 읽기
    readFile(file);
  };
  
  // 파일 선택 핸들러
  const handleClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };
  
  // 파일 읽기 및 처리
  const readFile = (file: File) => {
    const reader = new FileReader();
    
    reader.onload = (event) => {
      try {
        if (!event.target?.result) throw new Error('파일 내용을 읽을 수 없습니다.');
        
        // JSON 파싱
        const fileContent = event.target.result as string;
        const flowData = JSON.parse(fileContent) as FlowData;
        
        // Flow Data 유효성 검사
        if (!flowData || !flowData.nodes || !Array.isArray(flowData.nodes)) {
          throw new Error('유효하지 않은 Flow 데이터 형식입니다.');
        }
        
        // 노드 수 확인
        if (flowData.nodes.length === 0) {
          setError('Flow에 노드가 없습니다. 유효한 Flow를 업로드해주세요.');
          return;
        }
        
        // 에러 초기화
        setError('');
        
        // Flow를 체인에 등록
        if (activeChainId) {
          const flowId = addFlowToChain(activeChainId, flowData);
          console.log(`[FileUploader] Added flow to chain: chainId=${activeChainId}, flowId=${flowId}`);
          
          // 콜백 호출
          if (onFileUpload) {
            onFileUpload(flowData, activeChainId, flowId);
          }
        } else {
          console.warn('[FileUploader] No active chain selected');
          setError('Flow를 추가할 Chain이 선택되지 않았습니다.');
        }
      } catch (err) {
        console.error('[FileUploader] Error processing file:', err);
        setError(err instanceof Error ? err.message : String(err));
      }
    };
    
    reader.onerror = () => {
      setError('파일을 읽는 중 오류가 발생했습니다.');
    };
    
    reader.readAsText(file);
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