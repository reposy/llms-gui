import React, { useState, useRef, useEffect } from 'react';
import { importFlowFromJson, FlowData, exportFlowAsJson } from '../../utils/data/importExportUtils';
import { useFlowStructureStore } from '../../store/useFlowStructureStore';
import { pushCurrentSnapshot } from '../../utils/ui/historyUtils';
import { useMarkClean } from '../../store/useDirtyTracker';
import { createIDBStorage } from '../../utils/storage/idbStorage';
import { useExecutorStateStore } from '../../store/useExecutorStateStore';

interface FileUploaderProps {
  onFileUpload: (jsonData: any) => void;
  externalFileInputRef?: React.RefObject<HTMLInputElement>;
}

const FileUploader: React.FC<FileUploaderProps> = ({ onFileUpload, externalFileInputRef }) => {
  const [fileName, setFileName] = useState<string>('');
  const [error, setError] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const markClean = useMarkClean();
  
  // Executor 상태 스토어에서 필요한 함수들 가져오기
  const importFromEditor = useExecutorStateStore(state => state.importFromEditor);
  const executorFlowJson = useExecutorStateStore(state => state.flowJson);
  
  // 컴포넌트 마운트 시 기존 상태 확인
  useEffect(() => {
    if (executorFlowJson) {
      setFileName('이전에 불러온 플로우');
      onFileUpload(executorFlowJson);
    }
  }, [executorFlowJson, onFileUpload]);
  
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

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    handleFileSelected(file);
  };
  
  // 파일 처리 로직을 별도 함수로 분리 (이벤트 소스와 무관하게 처리 가능)
  const handleFileSelected = (file: File) => {
    setFileName(file.name);
    setError('');

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const flowData: FlowData = JSON.parse(e.target?.result as string);
        
        // 플로우 에디터의 상태에도 반영 (Flow Editor와 동일한 로직 적용)
        importFlowFromJson(flowData);
        
        // Flow Editor에도 상태 반영 (IndexedDB에 저장)
        setTimeout(() => {
          console.log('[FileUploader] Import complete, updating store state');
          
          const currentState = useFlowStructureStore.getState(); // Import 후 상태 가져오기
          const stateToSave = {
            state: {
              nodes: currentState.nodes,
              edges: currentState.edges,
              selectedNodeIds: currentState.selectedNodeIds 
            }
          };
          
          const idbStorage = createIDBStorage();
          // IDB에 상태 저장 (문자열로 변환)
          idbStorage.setItem('flow-structure-storage', JSON.stringify(stateToSave)); 
          console.log(`[FileUploader] Saved imported flow to indexedDB`);
          
          // 히스토리에 현재 상태 추가 및 'clean' 상태로 표시
          pushCurrentSnapshot();
          markClean();
          
          // Executor 상태 업데이트
          onFileUpload(flowData);
        }, 100);
      } catch (err) {
        console.error('JSON 파일 파싱 오류:', err);
        setError('유효하지 않은 JSON 파일입니다. 올바른 Flow JSON 파일을 업로드해주세요.');
      }
    };
    reader.onerror = () => {
      setError('파일 읽기 오류가 발생했습니다.');
    };
    reader.readAsText(file);
  };

  const handleButtonClick = () => {
    fileInputRef.current?.click();
  };
  
  // Flow Editor에서 현재 상태 가져오기
  const handleImportFromEditor = () => {
    try {
      // Flow Editor의 현재 상태 가져오기
      const flowData = exportFlowAsJson(true); // 실행 결과 포함
      
      // 상태 설정
      setFileName('Flow Editor에서 가져옴');
      
      // Flow Executor 상태 업데이트
      onFileUpload(flowData);
      
      // 상태 스토어에 저장
      importFromEditor();
      
    } catch (err) {
      console.error('Flow Editor에서 가져오기 오류:', err);
      setError('Flow Editor 상태를 가져오는 중 오류가 발생했습니다.');
    }
  };

  return (
    <div className="mb-6 p-4 border border-gray-300 rounded-lg bg-white">
      <h2 className="text-lg font-medium mb-3">Upload Flow JSON</h2>
      <div className="flex flex-col space-y-4">
        <input
          type="file"
          accept=".json"
          ref={fileInputRef}
          onChange={handleFileChange}
          className="hidden"
        />
        
        <div className="flex flex-wrap gap-3">
          <button
            onClick={handleButtonClick}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors flex items-center"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" />
            </svg>
            파일에서 가져오기
          </button>
          
          <button
            onClick={handleImportFromEditor}
            className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 transition-colors flex items-center"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            현재 Flow Editor 가져오기
          </button>
          
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
          가져온 플로우는 Flow Editor에도 자동으로 반영됩니다. Flow Editor에서 수정된 사항도 동일하게 적용됩니다.
        </p>
      </div>
    </div>
  );
};

export default FileUploader; 