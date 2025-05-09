import React, { useState, useRef } from 'react';
import { importFlowFromJson, FlowData } from '../../utils/data/importExportUtils';
import { useFlowStructureStore } from '../../store/useFlowStructureStore';
import { pushCurrentSnapshot } from '../../utils/ui/historyUtils';
import { useMarkClean } from '../../store/useDirtyTracker';
import { createIDBStorage } from '../../utils/storage/idbStorage';

interface FileUploaderProps {
  onFileUpload: (jsonData: any) => void;
}

const FileUploader: React.FC<FileUploaderProps> = ({ onFileUpload }) => {
  const [fileName, setFileName] = useState<string>('');
  const [error, setError] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const markClean = useMarkClean();

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

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

  return (
    <div className="mb-6 p-4 border border-gray-300 rounded-lg bg-white">
      <h2 className="text-lg font-medium mb-3">Upload Flow JSON</h2>
      <div className="flex flex-col space-y-2">
        <input
          type="file"
          accept=".json"
          ref={fileInputRef}
          onChange={handleFileChange}
          className="hidden"
        />
        <div className="flex items-center">
          <button
            onClick={handleButtonClick}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
          >
            Browse Files
          </button>
          <span className="ml-3 text-gray-600">
            {fileName || 'No file selected'}
          </span>
        </div>
        {error && <p className="text-red-500 text-sm">{error}</p>}
        <p className="text-sm text-gray-500 mt-2">
          가져온 플로우는 Flow Editor에도 자동으로 반영됩니다. Flow Editor에서 수정된 사항도 동일하게 적용됩니다.
        </p>
      </div>
    </div>
  );
};

export default FileUploader; 