import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useExecutorStateStore } from '../../store/useExecutorStateStore';
import ExportModal from './ExportModal';

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
  const { flowChain } = useExecutorStateStore();

  return (
    <>
      {/* 상단 네비게이션 바 */}
      <nav className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between shadow-sm">
        <h1 className="text-xl font-semibold text-gray-900">Flow Executor</h1>
        <div className="flex gap-2">
          <button
            onClick={onClearAll}
            className="px-3 py-1 text-red-600 border border-red-600 rounded hover:bg-red-50 transition-colors text-sm font-medium flex items-center"
            title="모든 Flow와 실행 결과를 초기화합니다."
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            모든 내용 초기화
          </button>
          
          <button
            onClick={onImportFlowChain}
            className="px-3 py-1 text-blue-600 border border-blue-600 rounded hover:bg-blue-50 transition-colors text-sm font-medium flex items-center"
            title="Flow Chain 파일을 가져와서 전체 Flow 환경을 복원합니다"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            Flow Chain 가져오기
          </button>
          
          <button
            onClick={() => {
              onExportFlowChain(`flow-chain-${new Date().toISOString().slice(0, 10)}.json`, false);
            }}
            className={`px-3 py-1 text-blue-600 border border-blue-600 rounded hover:bg-blue-50 transition-colors text-sm font-medium flex items-center ${flowChain.length === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
            disabled={flowChain.length === 0}
            title="Flow 체인을 데이터 없이 내보냅니다"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            내보내기
          </button>
          
          <button
            onClick={() => setExportModalOpen(true)}
            className={`px-3 py-1 text-blue-600 border border-blue-600 rounded hover:bg-blue-50 transition-colors text-sm font-medium flex items-center ${flowChain.length === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
            disabled={flowChain.length === 0}
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
            disabled={isExecuting || flowChain.length === 0}
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
          onExport={(filename) => {
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