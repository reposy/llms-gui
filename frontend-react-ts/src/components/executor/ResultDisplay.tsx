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
  outputFormat?: 'text' | 'markdown';
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

const ResultDisplay: React.FC<ResultDisplayProps> = ({ result, flowId, flowName, outputFormat = 'text' }) => {
  // 복사 상태 관리
  const [copiedNodeId, setCopiedNodeId] = useState<string | null>(null);
  // 결과 표시 모드 상태 (일반 텍스트 vs 마크다운)
  const [displayModes, setDisplayModes] = useState<{[nodeId: string]: 'text' | 'markdown'}>({});
  // 전체 결과 표시 모드 (outputs | markdown | json)
  const [viewMode, setViewMode] = useState<'outputs' | 'join' | 'raw'>('outputs');
  // Per-node view mode for outputs: 'text' | 'markdown'
  const [nodeViewModes, setNodeViewModes] = useState<{[nodeId: string]: 'text' | 'markdown'}>({});
  // join 모드 text/markdown toggle
  const [joinViewMode, setJoinViewMode] = useState<'text' | 'markdown'>('text');
  
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

  // Per-node toggle handler
  const toggleNodeViewMode = (nodeId: string) => {
    setNodeViewModes(prev => ({
      ...prev,
      [nodeId]: prev[nodeId] === 'markdown' ? 'text' : 'markdown',
    }));
  };

  // Helper to get per-node view mode (default 'text')
  const getNodeViewMode = (nodeId: string) => nodeViewModes[nodeId] || 'text';

  // 개별 노드 결과 렌더링
  const renderNodeResult = (nodeResult: Record<string, any>, index: number) => {
    // 두 가지 형태의 결과 객체 처리
    // 1. flowExecutionService.ts의 NodeResult 형태: { nodeId, outputs }
    // 2. outputCollector.ts의 NodeResult 형태: { nodeId, nodeName, nodeType, result }
    
    console.log(`[ResultDisplay] 결과 항목 ${index} 렌더링 시작:`, nodeResult);
    
    let nodeId, nodeName, nodeType, nodeOutput;
    
    if ('outputs' in nodeResult) {
      // flowExecutionService.ts 형태
      nodeId = nodeResult.nodeId;
      nodeName = nodeResult.nodeName || nodeId.split('-')[0] || 'Node';  // ID에서 간단한 이름 추출
      nodeType = nodeResult.nodeType || 'unknown';
      
      // outputs 배열에서 첫 번째 항목을 사용하거나, result 값이 있으면 그것을 사용
      if (nodeResult.result !== undefined) {
        nodeOutput = nodeResult.result;
        console.log(`[ResultDisplay] 노드 ${nodeId}의 result 값 사용:`, nodeOutput);
      } else if (nodeResult.outputs && nodeResult.outputs.length > 0) {
        nodeOutput = nodeResult.outputs[0];
        console.log(`[ResultDisplay] 노드 ${nodeId}의 outputs[0] 값 사용:`, nodeOutput);
      } else {
        nodeOutput = undefined;
        console.log(`[ResultDisplay] 노드 ${nodeId}에 출력 값 없음`);
      }
    } else {
      // outputCollector.ts 형태
      nodeId = nodeResult.nodeId;
      nodeName = nodeResult.nodeName || nodeId.split('-')[0] || 'Node';
      nodeType = nodeResult.nodeType || 'unknown';
      nodeOutput = nodeResult.result;
      console.log(`[ResultDisplay] 노드 ${nodeId}의 result 값 사용 (outputCollector 형태):`, nodeOutput);
    }
    
    // 결과 데이터를 문자열로 변환
    let resultText;
    if (nodeOutput === undefined || nodeOutput === null) {
      resultText = ''; // undefined/null인 경우 빈 문자열로 처리
      console.log(`[ResultDisplay] 노드 ${nodeId}의 결과 텍스트: 빈 값`);
    } else if (typeof nodeOutput === 'object') {
      resultText = JSON.stringify(nodeOutput, null, 2);
      console.log(`[ResultDisplay] 노드 ${nodeId}의 결과 텍스트: 객체를 JSON으로 변환`);
    } else {
      resultText = String(nodeOutput);
      console.log(`[ResultDisplay] 노드 ${nodeId}의 결과 텍스트: ${resultText.substring(0, 50)}${resultText.length > 50 ? '...' : ''}`);
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
            <button
              onClick={() => toggleNodeViewMode(nodeId)}
              className="px-3 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded border border-gray-300 transition-colors text-sm"
              title={currentDisplayMode === 'markdown' ? '텍스트로 보기' : '마크다운으로 보기'}
            >
              {currentDisplayMode === 'markdown' ? 'text' : 'markdown'}
            </button>
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
        
        {false ? (
          <div className="p-3 bg-gray-50 rounded border border-gray-200 max-h-80 overflow-y-auto markdown-content">
            <ReactMarkdown>{typeof nodeOutput === 'string' ? nodeOutput : JSON.stringify(nodeOutput, null, 2)}</ReactMarkdown>
          </div>
        ) : (
          <div className="p-3 bg-gray-50 rounded border border-gray-200 max-h-80 overflow-y-auto">
            <p className="whitespace-pre-wrap">{resultText}</p>
          </div>
        )}
      </div>
    );
  };

  // join 모드: 모든 노드 output을 한데 모아 text/markdown으로 보여줌
  const getJoinedOutputs = () => {
    if (!result || !Array.isArray(result.outputs)) return '';
    return result.outputs.map((nodeResult) => {
      if (typeof nodeResult === 'string') return nodeResult;
      if (typeof nodeResult === 'object' && nodeResult !== null) {
        if (Array.isArray(nodeResult.outputs)) {
          return nodeResult.outputs.map((out: any) => typeof out === 'string' ? out : JSON.stringify(out)).join('\n\n');
        } else if (typeof nodeResult.result === 'string') {
          return nodeResult.result;
        } else {
          return JSON.stringify(nodeResult);
        }
      }
      return '';
    }).join('\n\n');
  };

  // 복사 핸들러 (outputs, join, raw 모두에서 사용)
  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedNodeId('global');
      setTimeout(() => setCopiedNodeId(null), 2000);
    });
  };

  // 전체 결과 렌더링
  const renderAllResults = (mode: 'outputs' | 'join' | 'raw') => {
    if (!result || !result.outputs || result.outputs.length === 0) {
      let message = '출력 결과가 없습니다.';
      return (
        <>
          <h3 className="font-medium mb-2">{flowName} 결과</h3>
          <div className="text-gray-500 text-sm p-4">{message}</div>
        </>
      );
    }
    if (mode === 'outputs') {
      return (
        <>
          <h3 className="font-medium mb-2">{flowName} 결과 ({result.outputs.length} 항목)</h3>
          <div>
            {result.outputs.map((nodeResult, idx) => renderNodeResult(nodeResult, idx))}
          </div>
        </>
      );
    }
    if (mode === 'join') {
      const joined = getJoinedOutputs();
      return (
        <>
          <h3 className="font-medium mb-2">{flowName} 결과 ({result.outputs.length} 항목)</h3>
          <div className="flex justify-end mb-2">
            <button
              onClick={() => setJoinViewMode(joinViewMode === 'markdown' ? 'text' : 'markdown')}
              className="px-3 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded border border-gray-300 transition-colors text-sm mr-2"
            >
              {joinViewMode === 'markdown' ? 'text' : 'markdown'}
            </button>
            <button
              onClick={() => handleCopy(joined)}
              className="px-3 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded border border-gray-300 transition-colors text-sm flex items-center"
            >
              {copiedNodeId === 'global' ? (
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
          <div className="p-3 bg-gray-50 rounded border border-gray-200 max-h-96 overflow-y-auto">
            {joinViewMode === 'markdown' ? (
              <div className="markdown-content"><ReactMarkdown>{joined}</ReactMarkdown></div>
            ) : (
              <pre className="whitespace-pre-wrap text-sm">{joined}</pre>
            )}
          </div>
        </>
      );
    }
    // raw
    return (
      <>
        <h3 className="font-medium mb-2">{flowName} 결과 ({result.outputs.length} 항목)</h3>
        <div className="flex justify-end mb-2">
          <button
            onClick={() => handleCopy(JSON.stringify(result, null, 2))}
            className="px-3 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded border border-gray-300 transition-colors text-sm flex items-center"
          >
            {copiedNodeId === 'global' ? (
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
        <pre className="p-3 bg-gray-50 rounded border border-gray-200 max-h-96 overflow-y-auto whitespace-pre-wrap text-sm">
          {JSON.stringify(result, null, 2)}
        </pre>
      </>
    );
  };

  return (
    <div className="p-3 border border-gray-300 rounded-lg bg-white">
      {/* 글로벌 결과 표시 모드 토글 */}
      <div className="flex gap-2 mb-3">
        <button
          onClick={() => setViewMode('outputs')}
          className={`px-2 py-1 rounded border text-sm ${viewMode === 'outputs' ? 'bg-blue-100 text-blue-700 border-blue-300 font-bold' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-100'}`}
        >outputs</button>
        <button
          onClick={() => setViewMode('join')}
          className={`px-2 py-1 rounded border text-sm ${viewMode === 'join' ? 'bg-blue-100 text-blue-700 border-blue-300 font-bold' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-100'}`}
        >join</button>
        <button
          onClick={() => setViewMode('raw')}
          className={`px-2 py-1 rounded border text-sm ${viewMode === 'raw' ? 'bg-blue-100 text-blue-700 border-blue-300 font-bold' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-100'}`}
        >raw</button>
      </div>
      {renderAllResults(viewMode)}
    </div>
  );
};

export default ResultDisplay; 