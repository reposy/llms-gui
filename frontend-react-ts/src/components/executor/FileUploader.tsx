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
  const fileSelectorRef = useRef<{ openFileSelector: () => void }>(null);
  
  const { flows, activeChainId, addChain, addFlowToChain, setStage, getActiveChain } = useExecutorStateStore(
    (state) => ({
      flows: state.flows,
      activeChainId: state.flows.activeChainId,
      addChain: state.addChain,
      addFlowToChain: state.addFlowToChain,
      setStage: state.setStage,
      getActiveChain: state.getActiveChain,
    })
  );
  const chainIds = flows.chainIds;

  useEffect(() => {
    if (externalFileInputRef?.current) {
      const inputElement = externalFileInputRef.current;
      
      const fileChangeHandler = (e: Event) => {
        const target = e.target as HTMLInputElement;
        if (target.files && target.files[0]) {
          handleFileSelected(target.files[0]);
        }
      };
      
      inputElement.addEventListener('change', fileChangeHandler);
      
      return () => {
        inputElement.removeEventListener('change', fileChangeHandler);
      };
    }
  }, [externalFileInputRef]);

  const handleFileSelected = async (file: File) => {
    setFileName(file.name);
    setError('');

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const json = e.target?.result as string;
        let flowJsonData;
        
        try {
          flowJsonData = JSON.parse(json) as FlowData;
        } catch (parseError) {
          console.error(`[FileUploader] JSON 파싱 오류:`, parseError);
          setError('JSON 파일 형식이 올바르지 않습니다.');
          return;
        }
        
        if (!flowJsonData || typeof flowJsonData !== 'object') {
          setError('유효하지 않은 Flow 파일 형식입니다.');
          return;
        }
        
        const flowNameFromFile = flowJsonData.name || file.name.replace(/\.json$/, '') || '가져온 Flow';

        let targetChainId = activeChainId;
        let isNewChain = false;

        if (!targetChainId || chainIds.length === 0) {
          const newChainName = flowNameFromFile;
          addChain(newChainName);
          await new Promise(resolve => setTimeout(resolve, 0));
          
          const updatedActiveChainId = useExecutorStateStore.getState().flows.activeChainId;
          if (!updatedActiveChainId) {
            console.error('[FileUploader] 새 체인 생성 후 activeChainId를 가져올 수 없습니다.');
            setError('새 체인을 만들고 활성화하는 데 실패했습니다.');
            return;
          }
          targetChainId = updatedActiveChainId;
          isNewChain = true;
          console.log(`[FileUploader] New chain created and activated: ${targetChainId}`);
        }

        if (!targetChainId) {
          console.error('[FileUploader] 대상 체인 ID를 결정할 수 없습니다.');
          setError('Flow를 추가할 대상 체인을 찾을 수 없습니다.');
          return;
        }

        addFlowToChain(targetChainId, flowJsonData);
        const currentChain = useExecutorStateStore.getState().getChain(targetChainId);
        const addedFlowId = currentChain?.flowIds[currentChain.flowIds.length -1];

        if (chainIds.length === 0 || isNewChain) {
          setStage('input');
        }
        
        if (onFileUpload) {
          onFileUpload(flowJsonData, targetChainId, addedFlowId);
        }
        
        console.log(`[FileUploader] Flow imported successfully into chain ${targetChainId}${addedFlowId ? ' with flow ID ' + addedFlowId : ''}`);
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
        {(chainIds || []).length === 0 ? 'Flow 업로드하기' : 'Flow 추가하기'}
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
          {(chainIds || []).length === 0 
            ? 'Flow 파일(.json)을 선택하여 실행할 Flow를 추가하세요.'
            : '추가 Flow 파일(.json)을 선택하여 체인에 추가하세요. Flow의 실행 순서는 나중에 조정할 수 있습니다.'}
        </p>
      </div>
    </div>
  );
};

export default FileUploader; 