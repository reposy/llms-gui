import React, { useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useFlowExecutorStore } from '../../store/useFlowExecutorStore';
import ExportModal from './ExportModal';
import FileSelector from './FileSelector';

interface ExecutorPanelProps {
  onImportFlowChain: () => void;
  onExportFlowChain: (filename: string, includeData: boolean) => void;
  onExecuteFlow: () => void;
  onClearAll: () => void;
  isExecuting: boolean;
}

/**
 * 상단 네비게이션 바 컴포넌트
 * Flow Executor의 주요 컨트롤 버튼들을 포함합니다.
 */
const ExecutorPanel: React.FC<ExecutorPanelProps> = ({
  onImportFlowChain,
  onExportFlowChain,
  onExecuteFlow,
  onClearAll,
  isExecuting
}) => {
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const fileSelectorRef = useRef<{ openFileSelector: () => void }>(null);

  // 스토어에서 필요한 상태 가져오기
  const store = useFlowExecutorStore();
  const focusedFlowChainId = store.focusedFlowChainId;
  const { 
    flowChainMap, 
    setStage
  } = useFlowExecutorStore();
  
  // 활성 체인의 Flow 개수 계산 (안전하게 접근)
  const focusedChain = focusedFlowChainId ? store.getChain(focusedFlowChainId) : undefined;
  const hasFlows = focusedChain && focusedChain.flowIds.length > 0;
  const flowChainIds = Object.keys(flowChainMap);

  // Flow Chain 파일 선택 처리
  const handleFlowChainFileSelected = (file: File) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = event.target?.result as string;
        let importData;
        
        try {
          importData = JSON.parse(json);
        } catch (parseError) {
          console.error(`[ExecutorPanel] JSON 파싱 오류:`, parseError);
          alert('JSON 파일 형식이 올바르지 않습니다.');
          return;
        }
        
        // 기본 유효성 검사
        if (!importData || typeof importData !== 'object') {
          throw new Error('유효하지 않은 Flow 체인 파일 형식입니다.');
        }
        
        // 버전 확인
        if (!importData.version) {
          console.warn('[ExecutorPanel] 버전 정보가 없는 파일입니다.');
          // 버전 없이 계속 진행
        }
        
        // flowChain 배열 존재 확인
        if (!Array.isArray(importData.flowChain)) {
          // flowChain이 없으면 단일 Flow JSON으로 가정하고 변환 시도
          console.log('[ExecutorPanel] flowChain 배열이 없습니다. 단일 Flow JSON으로 처리합니다.');
          
          // 단일 Flow 객체 생성
          importData = {
            version: '1.0',
            flowChain: [{
              id: `flow-${Date.now()}`,
              name: file.name.replace(/\.json$/, '') || '가져온 Flow',
              flowJson: importData,
              inputData: []
            }]
          };
        }
        
        // 각 Flow 추가
        const addFlowToChain = store.addFlowToChain;
        const setFlowInputData = store.setFlowInputData;
        const setStage = store.setStage;
        const focusedChain = focusedFlowChainId ? store.getChain(focusedFlowChainId) : undefined;
        const flowChainId = focusedChain?.id || '';
        
        importData.flowChain.forEach((flow: any) => {
          try {
            // flowJson 유효성 검사
            if (!flow.flowJson || typeof flow.flowJson !== 'object') {
              console.warn(`[ExecutorPanel] 유효하지 않은 flowJson 형식, flow:`, flow);
              return; // 이 Flow는 건너뛰고 계속 진행
            }
            
            // 원본 ID 보존: flow.id가 있으면 해당 ID 사용, 없으면 파일명 기반 ID 생성
            const flowName = flow.name || flow.flowJson.name || '가져온-flow';
            
            // Flow 추가 (원본 ID 보존)
            if (flowChainId) {
              addFlowToChain(flowChainId, flow.flowJson);
              
              // 새로 추가된 Flow ID 얻기
              const updatedChain = store.getChain(flowChainId);
              if (updatedChain) {
                const flowId = updatedChain.flowIds[updatedChain.flowIds.length - 1];
                
                // 입력 데이터 설정
                if (flow.inputData && flow.inputData.length > 0) {
                  setFlowInputData(flowChainId, flowId, flow.inputData);
                }
              }
            } else {
              // 활성 체인이 없으면 새 체인 생성 후 Flow 추가
              console.warn('[ExecutorPanel] 활성 체인이 없습니다. 새 체인 생성 필요');
            }
          } catch (flowError) {
            console.error(`[ExecutorPanel] Flow 추가 중 오류:`, flowError);
            // 이 Flow는 건너뛰고 계속 진행
          }
        });
        
        // 스테이지 업데이트
        if (flowChainIds.length === 0) {
          setStage('input');
        }
        
        console.log(`[ExecutorPanel] Flow chain imported successfully`);
      } catch (error) {
        console.error(`[ExecutorPanel] Error parsing imported flow chain:`, error);
        alert(`Flow 체인 파일을 파싱하는 도중 오류가 발생했습니다: ${error instanceof Error ? error.message : '알 수 없는 오류'}`);
      }
    };
    
    reader.readAsText(file);
  };

  const handleAddFlow = (flow: any) => {
    if (focusedFlowChainId) {
      store.addFlowToChain(focusedFlowChainId, flow.flowJson);
    }
  };

  return (
    <>
      {/* 상단 네비게이션 바 */}
      <nav className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between shadow-sm">
        <h1 className="text-xl font-semibold text-gray-900">Flow Executor</h1>
        <div className="flex gap-2">
          <button
            onClick={() => {
              console.log('[ExecutorPanel] 모든 내용 초기화 버튼 클릭됨');
              onClearAll();
            }}
            className="px-3 py-1 text-red-600 border border-red-600 rounded hover:bg-red-50 transition-colors text-sm font-medium flex items-center"
            title="모든 Flow와 실행 결과를 초기화합니다."
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            모든 내용 초기화
          </button>
          
          <FileSelector
            onFileSelected={handleFlowChainFileSelected}
            accept=".json"
            buttonText="Flow Chain 가져오기"
            fileSelectorRef={fileSelectorRef}
            buttonClassName="px-3 py-1 text-blue-600 border border-blue-600 rounded hover:bg-blue-50 transition-colors text-sm font-medium flex items-center"
          />
          
          <button
            onClick={() => {
              onExportFlowChain(`flow-chain-${new Date().toISOString().slice(0, 10)}.json`, false);
            }}
            className={`px-3 py-1 text-blue-600 border border-blue-600 rounded hover:bg-blue-50 transition-colors text-sm font-medium flex items-center ${flowChainIds.length === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
            disabled={flowChainIds.length === 0}
            title="Flow 체인을 데이터 없이 내보냅니다"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            내보내기
          </button>

          <button
            onClick={() => setExportModalOpen(true)}
            className={`px-3 py-1 text-blue-600 border border-blue-600 rounded hover:bg-blue-50 transition-colors text-sm font-medium flex items-center ${flowChainIds.length === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
            disabled={flowChainIds.length === 0}
            title="Flow 체인을 데이터 포함하여 내보냅니다"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            데이터 포함 내보내기
          </button>
          
          <Link
            to="/editor"
            className="px-3 py-1 text-blue-600 border border-blue-600 rounded hover:bg-blue-50 transition-colors text-sm font-medium flex items-center"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            Go to Editor
          </Link>
          
          <button
            className="px-3 py-1 bg-indigo-600 text-white rounded hover:bg-indigo-700 transition-colors shadow-sm text-sm font-medium flex items-center"
            onClick={onExecuteFlow}
            disabled={isExecuting || flowChainIds.length === 0}
          >
            {isExecuting ? (
              <div className="flex items-center">
                <svg className="animate-spin h-4 w-4 mr-1" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                실행 중...
              </div>
            ) : (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                플로우 실행
              </>
            )}
          </button>
        </div>
      </nav>

      {/* 내보내기 모달 */}
      {exportModalOpen && (
        <ExportModal
          isOpen={exportModalOpen}
          onClose={() => setExportModalOpen(false)}
          onExport={(filename, includeData) => {
            onExportFlowChain(filename, true);
            setExportModalOpen(false);
          }}
          defaultFilename={`flow-chain-with-data-${new Date().toISOString().slice(0, 10)}.json`}
        />
      )}
    </>
  );
};

export default ExecutorPanel; 