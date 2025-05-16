import React, { useState, useRef, useEffect } from 'react';
import { FlowData } from '../../utils/data/importExportUtils';
import { useExecutorStateStore } from '../../store/useExecutorStateStore';
import FileSelector from './FileSelector';

interface FileUploaderProps {
  onFileUpload?: (flowData: FlowData, chainId?: string, flowId?: string) => void;
  externalFileInputRef?: React.RefObject<HTMLInputElement>;
  className?: string;
}

const FileUploader: React.FC<FileUploaderProps> = ({ onFileUpload, externalFileInputRef, className = '' }) => {
  const [fileName, setFileName] = useState<string>('');
  const [error, setError] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const addFlowToChain = useExecutorStateStore(state => state.addFlowToChain);
  const activeChainId = useExecutorStateStore(state => state.flowExecutorStore?.activeChainId || null);
  
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
  };
  
  return (
    <div className={`flow-uploader ${className}`}>
      <div
        className="upload-area"
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onClick={handleClick}
      >
        <p>Flow JSON 파일을 드래그하거나 클릭하여 업로드하세요</p>
        {fileName && <p className="file-name">선택된 파일: {fileName}</p>}
        {error && <p className="error-message">{error}</p>}
      </div>
      
      <input
        type="file"
        ref={fileInputRef}
        className="hidden-input"
        accept=".json"
        onChange={(e) => handleFileChange(e.nativeEvent)}
      />
      
      <FileSelector onFileSelected={readFile} accept=".json" buttonText="파일 선택" />
    </div>
  );
};

export default FileUploader; 