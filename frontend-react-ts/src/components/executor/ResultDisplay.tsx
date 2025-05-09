import React, { useState } from 'react';
import { NodeResult } from '../../core/outputCollector';

interface ResultDisplayProps {
  result: NodeResult[] | null;
  isLoading: boolean;
  error: string | null;
}

const ResultDisplay: React.FC<ResultDisplayProps> = ({ result, isLoading, error }) => {
  // 복사 상태 관리
  const [copiedNodeId, setCopiedNodeId] = useState<string | null>(null);
  
  // 결과 복사 함수
  const copyToClipboard = (text: string, nodeId: string) => {
    navigator.clipboard.writeText(text).then(
      () => {
        setCopiedNodeId(nodeId);
        setTimeout(() => setCopiedNodeId(null), 2000);
      },
      (err) => {
        console.error('클립보드에 복사하지 못했습니다:', err);
      }
    );
  };

  // 개별 노드 결과 렌더링
  const renderNodeResult = (nodeResult: NodeResult, index: number) => {
    const { nodeId, nodeName, nodeType, result: nodeOutput } = nodeResult;
    
    // 결과 데이터를 문자열로 변환
    const resultText = typeof nodeOutput === 'object' 
      ? JSON.stringify(nodeOutput, null, 2)
      : String(nodeOutput);
    
    return (
      <div key={nodeId || index} className="p-4 bg-white rounded-lg border border-gray-300 mb-4 shadow-sm">
        <div className="flex justify-between items-center mb-3">
          <div>
            <h3 className="font-medium text-blue-600">
              {nodeName}
              <span className="ml-2 text-xs text-gray-500">
                {nodeType !== 'unknown' ? `(${nodeType})` : ''}
              </span>
            </h3>
          </div>
          <button
            onClick={() => copyToClipboard(resultText, nodeId)}
            className="px-3 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded border border-gray-300 transition-colors text-sm flex items-center"
          >
            {copiedNodeId === nodeId ? (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                복사됨
              </>
            ) : (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" />
                </svg>
                복사
              </>
            )}
          </button>
        </div>
        
        {typeof nodeOutput === 'object' ? (
          <pre className="p-3 bg-gray-50 rounded border border-gray-200 max-h-80 overflow-y-auto whitespace-pre-wrap text-sm">
            {JSON.stringify(nodeOutput, null, 2)}
          </pre>
        ) : (
          <div className="p-3 bg-gray-50 rounded border border-gray-200 max-h-80 overflow-y-auto">
            <p className="whitespace-pre-wrap">{String(nodeOutput)}</p>
          </div>
        )}
      </div>
    );
  };

  // 전체 결과 렌더링
  const renderAllResults = () => {
    if (!result || result.length === 0) {
      return <p className="text-gray-500">실행된 리프 노드의 결과가 없습니다.</p>;
    }

    return (
      <div className="space-y-3">
        <h3 className="font-medium">리프 노드 결과 ({result.length} 항목)</h3>
        <div>
          {result.map((nodeResult, index) => renderNodeResult(nodeResult, index))}
        </div>
      </div>
    );
  };

  return (
    <div className="p-4 border border-gray-300 rounded-lg bg-white">
      <h2 className="text-lg font-medium mb-3">실행 결과</h2>
      
      {isLoading ? (
        <div className="flex items-center justify-center p-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
          <span className="ml-3">워크플로우 실행 중...</span>
        </div>
      ) : error ? (
        <div className="p-4 bg-red-50 border border-red-200 rounded text-red-600">
          <h3 className="font-medium mb-2">오류</h3>
          <p>{error}</p>
        </div>
      ) : result ? (
        renderAllResults()
      ) : (
        <p className="text-gray-500">표시할 결과가 없습니다. 워크플로우를 실행하세요.</p>
      )}
    </div>
  );
};

export default ResultDisplay; 