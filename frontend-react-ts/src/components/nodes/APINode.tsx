import { useState, useCallback } from 'react';
import { Handle, Position } from 'reactflow';
import type { NodeProps } from 'reactflow';
import { NodeData, APINodeData } from '../../types/nodes';

const APINode = ({ data, id }: NodeProps<NodeData>) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (data.type !== 'api') return null;

  const apiData = data as APINodeData;

  const handleExecute = useCallback(async () => {
    if (!apiData.url) {
      setError('URL을 설정해주세요.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(apiData.url, {
        method: apiData.method || 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...apiData.headers,
        },
      });

      if (!response.ok) {
        throw new Error(`API 요청 실패: ${response.status}`);
      }

      const result = await response.json();

      // Store the result in the node's data
      const event = new CustomEvent('nodeExecuted', {
        detail: { nodeId: id, result }
      });
      window.dispatchEvent(event);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'API 호출 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  }, [apiData, id]);

  return (
    <div className="px-4 py-3 shadow-lg rounded-xl bg-white border-2 border-green-500/50 hover:border-green-500 transition-colors duration-200">
      <Handle type="target" position={Position.Top} className="w-2 h-2" />
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="text-lg font-bold text-green-500">API</div>
            {apiData.method && (
              <div className="px-2 py-0.5 bg-green-100 text-green-700 text-xs font-medium rounded-full">
                {apiData.method}
              </div>
            )}
          </div>
          <button
            onClick={handleExecute}
            disabled={isLoading}
            className="px-3 py-1 text-sm bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors duration-200 flex items-center gap-1"
          >
            {isLoading ? (
              <>
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <span>실행 중</span>
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                </svg>
                <span>실행</span>
              </>
            )}
          </button>
        </div>
        <div className="text-sm text-gray-600 flex items-center gap-1">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
          </svg>
          {apiData.url || 'URL 미설정'}
        </div>
        {error && (
          <div className="text-sm text-red-500 bg-red-50 px-2 py-1 rounded-lg flex items-center gap-1">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {error}
          </div>
        )}
      </div>
      <Handle type="source" position={Position.Bottom} className="w-2 h-2" />
    </div>
  );
};

export default APINode; 