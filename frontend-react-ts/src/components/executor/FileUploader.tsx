import React, { useState, useRef, useEffect } from 'react';
import { FlowData } from '../../utils/data/importExportUtils';
import { useExecutorStateStore } from '../../store/useExecutorStateStore';
import FileSelector from './FileSelector';

interface FileUploaderProps {
  onFileUpload?: (jsonData: FlowData) => void;
  externalFileInputRef?: React.RefObject<HTMLInputElement>;
  className?: string;
}

const FileUploader: React.FC<FileUploaderProps> = ({ onFileUpload, externalFileInputRef, className = '' }) => {
  const [fileName, setFileName] = useState<string>('');
  const [error, setError] = useState<string>('');
  const fileSelectorRef = useRef<{ openFileSelector: () => void }>(null);
  
  const addFlow = useExecutorStateStore(state => state.addFlow);
  const flowChain = useExecutorStateStore(state => state.flowChain);
  const setStage = useExecutorStateStore(state => state.setStage);
  
  // 외부 파일 입력 참조가 변경 이벤트를 수신하도록 설정
  useEffect(() => {
    if (externalFileInputRef?.current) {
      const inputElement = externalFileInputRef.current;
      
      // 파일 변경 이벤트 핸들러 등록
      const fileChangeHandler = (e: Event) => {
        const target = e.target as HTMLInputElement;
        if (target.files && target.files[0]) {
          handleFileSelected(target.files[0]);
        }
      };
      
      // 이벤트 리스너 등록
      inputElement.addEventListener('change', fileChangeHandler);
      
      // 컴포넌트 언마운트 시 이벤트 리스너 제거
      return () => {
        inputElement.removeEventListener('change', fileChangeHandler);
      };
    }
  }, [externalFileInputRef]);

  // 파일 처리 로직
  const handleFileSelected = (file: File) => {
    setFileName(file.name);
    setError('');

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const json = e.target?.result as string;
        let flowData;
        
        try {
          flowData = JSON.parse(json);
        } catch (parseError) {
          console.error(`[FileUploader] JSON 파싱 오류:`, parseError);
          setError('JSON 파일 형식이 올바르지 않습니다.');
          return;
        }
        
        // 기본 유효성 검사
        if (!flowData || typeof flowData !== 'object') {
          throw new Error('유효하지 않은 Flow 파일 형식입니다.');
          return;
        }
        
        // 파일명에서 특수문자 제거하고 소문자로 변환하여 ID 생성
        const flowName = file.name.replace(/\.json$/, '') || '가져온 Flow';
        const timestamp = Date.now();
        const random = Math.floor(Math.random() * 1000);
        const namePart = flowName.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase().substring(0, 20);
        const flowId = `${namePart}-${timestamp}-${random}`;
        
        const flowToAdd = {
          ...flowData,
          id: flowId,
          name: flowName
        };
        
        // Flow 추가
        addFlow(flowToAdd);
        
        // 다음 단계로 이동
        if (flowChain.length === 0) {
          setStage('input');
        }
        
        // 외부 콜백이 있으면 호출
        if (onFileUpload) {
          onFileUpload(flowToAdd);
        }
        
        console.log(`[FileUploader] Flow imported successfully: ${flowId}`);
      } catch (err) {
        console.error('Flow 파일 처리 오류:', err);
        setError('유효하지 않은 Flow 파일입니다. 올바른 Flow JSON 파일을 업로드해주세요.');
      }
    };
    reader.onerror = () => {
      setError('파일 읽기 오류가 발생했습니다.');
    };
    reader.readAsText(file);
  };

  return (
    <div className={`p-4 border border-gray-300 rounded-lg bg-white ${className}`}>
      <h2 className="text-lg font-medium mb-3">
        {flowChain.length === 0 ? 'Flow 업로드하기' : 'Flow 추가하기'}
      </h2>
      <div className="flex flex-col space-y-4">
        <div className="flex flex-wrap gap-3">
          <FileSelector 
            onFileSelected={handleFileSelected}
            accept=".json"
            buttonText="파일에서 가져오기"
            fileSelectorRef={fileSelectorRef}
          />
          
          {fileName && (
            <div className="px-3 py-2 bg-gray-100 rounded flex-1 flex items-center">
              <span className="text-gray-600 truncate">
                {fileName}
              </span>
            </div>
          )}
        </div>
        
        {error && <p className="text-red-500 text-sm">{error}</p>}
        <p className="text-sm text-gray-500">
          {flowChain.length === 0 
            ? 'Flow 파일(.json)을 선택하여 실행할 Flow를 추가하세요.'
            : '추가 Flow 파일(.json)을 선택하여 체인에 추가하세요. Flow의 실행 순서는 나중에 조정할 수 있습니다.'}
        </p>
      </div>
    </div>
  );
};

export default FileUploader; 