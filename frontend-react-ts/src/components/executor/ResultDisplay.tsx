import React, { useState, useEffect } from 'react';
import { NodeResult } from '../../core/outputCollector';
import { ExecutionStatus } from '../../store/useExecutorStateStore';
import ReactMarkdown from 'react-markdown';
import './markdown-style.css';

// FlowExecutionResult 인터페이스 직접 정의
interface FlowExecutionResult {
  status: ExecutionStatus;
  outputs: any[];
  error?: string;
  flowId?: string;
}

interface ResultDisplayProps {
  result: FlowExecutionResult | null;
  flowId: string;
  flowName: string;
}

// 문자열이 마크다운 형식인지 대략 확인하는 함수
const isMarkdownLike = (text: string): boolean => {
  const markdownPatterns = [
    /^#\s+.+/m,  // 제목
    /\*\*.+\*\*/,  // 볼드
    /\*.+\*/,     // 이탤릭
    /!\[.+\]\(.+\)/,  // 이미지
    /\[.+\]\(.+\)/,   // 링크
    /^-\s+.+/m,       // 리스트
    /^>\s+.+/m,       // 인용
    /^```[\s\S]*```/m, // 코드 블록
    /^#{1,6}\s+.+/m    // 제목 (다른 레벨)
  ];
  
  return markdownPatterns.some(pattern => pattern.test(text));
};

const ResultDisplay: React.FC<ResultDisplayProps> = ({ result, flowId, flowName }) => {
  // 복사 상태 관리
  const [copiedNodeId, setCopiedNodeId] = useState<string | null>(null);
  // 결과 표시 모드 상태 (일반 텍스트 vs 마크다운)
  const [displayModes, setDisplayModes] = useState<{[nodeId: string]: 'text' | 'markdown'}>({});
  
  useEffect(() => {
    console.log(`[ResultDisplay] Component received flowId: ${flowId}, entire result object:`, result);
  }, [flowId, result]);

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

  // 표시 모드 토글 함수
  const toggleDisplayMode = (nodeId: string) => {
    setDisplayModes(prevModes => ({
      ...prevModes,
      [nodeId]: prevModes[nodeId] === 'markdown' ? 'text' : 'markdown'
    }));
  };

  // 노드 결과의 초기 표시 모드 결정
  const getInitialDisplayMode = (nodeId: string, content: string): 'text' | 'markdown' => {
    if (displayModes[nodeId]) return displayModes[nodeId];
    
    // 마크다운으로 보이면 마크다운 모드, 아니면 텍스트 모드
    return isMarkdownLike(content) ? 'markdown' : 'text';
  };

  // 개별 노드 결과 렌더링
  const renderNodeResult = (nodeResult: Record<string, any>, index: number) => {
    // 두 가지 형태의 결과 객체 처리
    // 1. flowExecutionService.ts의 NodeResult 형태: { nodeId, outputs }
    // 2. outputCollector.ts의 NodeResult 형태: { nodeId, nodeName, nodeType, result }
    
    let nodeId, nodeName, nodeType, nodeOutput;
    
    if ('outputs' in nodeResult) {
      // flowExecutionService.ts 형태
      nodeId = nodeResult.nodeId;
      nodeName = nodeId.split('-')[0] || 'Node';  // ID에서 간단한 이름 추출
      nodeType = 'unknown';
      nodeOutput = nodeResult.outputs && nodeResult.outputs.length > 0 ? nodeResult.outputs[0] : undefined;
    } else {
      // outputCollector.ts 형태
      nodeId = nodeResult.nodeId;
      nodeName = nodeResult.nodeName || nodeId.split('-')[0] || 'Node';
      nodeType = nodeResult.nodeType || 'unknown';
      nodeOutput = nodeResult.result;
    }
    
    // 결과 데이터를 문자열로 변환
    let resultText;
    if (nodeOutput === undefined || nodeOutput === null) {
      resultText = ''; // undefined/null인 경우 빈 문자열로 처리
    } else if (typeof nodeOutput === 'object') {
      resultText = JSON.stringify(nodeOutput, null, 2);
    } else {
      resultText = String(nodeOutput);
    }
    
    // 초기 표시 모드 설정 (이미 설정된 모드가 없으면)
    if (typeof nodeOutput === 'string' && !displayModes[nodeId]) {
      const initialMode = getInitialDisplayMode(nodeId, nodeOutput);
      if (!displayModes[nodeId]) {
        setDisplayModes(prevModes => ({
          ...prevModes,
          [nodeId]: initialMode
        }));
      }
    }
    
    const currentDisplayMode = typeof nodeOutput === 'string' 
      ? (displayModes[nodeId] || getInitialDisplayMode(nodeId, nodeOutput)) 
      : 'text';
    
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
          <div className="flex items-center space-x-2">
            {typeof nodeOutput === 'string' && (
              <button
                onClick={() => toggleDisplayMode(nodeId)}
                className="px-3 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded border border-gray-300 transition-colors text-sm"
                title={currentDisplayMode === 'markdown' ? '텍스트로 보기' : '마크다운으로 보기'}
              >
                {currentDisplayMode === 'markdown' ? '텍스트로 보기' : '마크다운으로 보기'}
              </button>
            )}
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
        </div>
        
        {typeof nodeOutput === 'object' ? (
          <pre className="p-3 bg-gray-50 rounded border border-gray-200 max-h-80 overflow-y-auto whitespace-pre-wrap text-sm">
            {JSON.stringify(nodeOutput, null, 2)}
          </pre>
        ) : nodeOutput === undefined || nodeOutput === null ? (
          <div className="p-3 bg-gray-50 rounded border border-gray-200 max-h-80 overflow-y-auto">
            <p className="text-gray-500 italic">결과 없음</p>
          </div>
        ) : currentDisplayMode === 'markdown' ? (
          <div className="p-3 bg-gray-50 rounded border border-gray-200 max-h-80 overflow-y-auto markdown-content">
            <ReactMarkdown>{nodeOutput}</ReactMarkdown>
          </div>
        ) : (
          <div className="p-3 bg-gray-50 rounded border border-gray-200 max-h-80 overflow-y-auto">
            <p className="whitespace-pre-wrap">{resultText}</p>
          </div>
        )}
      </div>
    );
  };

  // 전체 결과 렌더링
  const renderAllResults = () => {
    if (!result || !result.outputs || result.outputs.length === 0) {
      console.log(`[ResultDisplay] No results or empty outputs for flow ${flowId}`, result);
      let message = '아직 실행된 결과가 없습니다. Flow를 실행하세요.';
      if (result && result.status === 'error') {
        message = `오류가 발생했습니다: ${result.error || '알 수 없는 오류'}`;
      } else if (result && result.outputs && result.outputs.length === 0) {
        message = '실행되었지만 반환된 결과가 없습니다.';
      }

      return (
        <div className="text-center py-8 text-gray-500">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mx-auto text-gray-400 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
          </svg>
          <h3 className="text-lg font-medium mb-1">{flowName} 결과</h3>
          <p>{message}</p>
        </div>
      );
    }

    const outputsToRender = result.outputs;
    console.log(`[ResultDisplay] Rendering ${outputsToRender.length} results for flow ${flowId}`);

    return (
      <div className="space-y-3">
        <h3 className="font-medium">{flowName} 결과 ({outputsToRender.length} 항목)</h3>
        <div>
          {outputsToRender.map((nodeResult, index) => renderNodeResult(nodeResult, index))}
        </div>
      </div>
    );
  };

  return (
    <div className="p-3 border border-gray-300 rounded-lg bg-white">
      {result && (result.status === 'success' || result.status === 'running') ? (
        renderAllResults()
      ) : result && result.status === 'error' ? (
        <div className="text-center py-8 text-red-500">
           <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mx-auto text-red-400 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <h3 className="text-lg font-medium mb-1">{flowName} 실행 오류</h3>
          <p>{result.error || '알 수 없는 오류가 발생했습니다.'}</p>
        </div>
      ) : (
        <div className="text-center py-8 text-gray-500">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mx-auto text-gray-400 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
          </svg>
          <h3 className="text-lg font-medium mb-1">{flowName} 결과</h3>
          <p>표시할 결과가 없습니다. Flow를 선택하고 실행하세요.</p>
        </div>
      )}
    </div>
  );
};

export default ResultDisplay; 