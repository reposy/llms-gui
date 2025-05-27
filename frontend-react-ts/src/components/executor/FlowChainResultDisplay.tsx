import React, { useState } from 'react';
import FlowResultDisplay from './FlowResultDisplay';
import ReactMarkdown from 'react-markdown';

interface FlowResult {
  flowId: string;
  flowName: string;
  result: any; // lastResults
}

interface FlowChainResultDisplayProps {
  flowResults: FlowResult[];
}

const FlowChainResultDisplay: React.FC<FlowChainResultDisplayProps> = ({ flowResults }) => {
  const [viewMode, setViewMode] = useState<'outputs' | 'join' | 'raw'>('outputs');
  const [joinViewMode, setJoinViewMode] = useState<'text' | 'markdown'>('text');
  const [copied, setCopied] = useState(false);

  // Helper for join mode
  const getJoinedOutputs = () => {
    return flowResults.map(fr => {
      if (!fr.result || !Array.isArray(fr.result)) return '';
      return fr.result.map((nodeResult: any) => {
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
    }).join('\n\n');
  };

  // Helper for join mode heading
  const getJoinHeading = () => {
    if (flowResults.length === 0) return '';
    if (flowResults.length === 1) return flowResults[0].flowName;
    return `${flowResults[0].flowName} 포함 ${flowResults.length}항목`;
  };

  // Helper for raw mode
  const getRawJson = () => JSON.stringify(flowResults.map(fr => fr.result), null, 2);

  // 복사 핸들러
  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  if (flowResults.length === 0) {
    return <div className="text-gray-500 text-sm p-4">선택된 flow가 없습니다.</div>;
  }

  if (viewMode === 'outputs') {
    return (
      <div>
        {flowResults.map(fr => (
          <div key={fr.flowId} className="mb-6 border border-gray-200 rounded-lg bg-gray-50 p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="font-semibold text-blue-700">{fr.flowName}</span>
              <button
                onClick={() => handleCopy(JSON.stringify(fr.result, null, 2))}
                className="px-3 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded border border-gray-300 transition-colors text-sm flex items-center"
              >
                {copied ? (
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
            <FlowResultDisplay 
              result={fr.result ? { status: 'success', outputs: fr.result, flowId: fr.flowId } : null} 
              flowId={fr.flowId} flowName={fr.flowName} />
          </div>
        ))}
      </div>
    );
  }

  if (viewMode === 'join') {
    const joined = getJoinedOutputs();
    return (
      <div className="border border-gray-200 rounded-lg bg-gray-50 p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="font-semibold text-blue-700">{getJoinHeading()}</span>
          <div className="flex gap-2">
            <button
              onClick={() => setJoinViewMode(joinViewMode === 'markdown' ? 'text' : 'markdown')}
              className="px-3 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded border border-gray-300 transition-colors text-sm"
            >
              {joinViewMode === 'markdown' ? 'text' : 'markdown'}
            </button>
            <button
              onClick={() => handleCopy(joined)}
              className="px-3 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded border border-gray-300 transition-colors text-sm flex items-center"
            >
              {copied ? (
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
        <div className="p-3 bg-white rounded border border-gray-200 max-h-96 overflow-y-auto">
          {joinViewMode === 'markdown' ? (
            <div className="markdown-content"><ReactMarkdown>{joined}</ReactMarkdown></div>
          ) : (
            <pre className="whitespace-pre-wrap text-sm">{joined}</pre>
          )}
        </div>
      </div>
    );
  }

  // raw
  return (
    <div className="border border-gray-200 rounded-lg bg-gray-50 p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="font-semibold text-blue-700">{getJoinHeading()}</span>
        <button
          onClick={() => handleCopy(getRawJson())}
          className="px-3 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded border border-gray-300 transition-colors text-sm flex items-center"
        >
          {copied ? (
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
      <pre className="p-3 bg-white rounded border border-gray-200 max-h-96 overflow-y-auto whitespace-pre-wrap text-sm">
        {getRawJson()}
      </pre>
    </div>
  );
};

export default FlowChainResultDisplay; 