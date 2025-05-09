import React from 'react';

interface ResultDisplayProps {
  result: any;
  isLoading: boolean;
  error: string | null;
}

const ResultDisplay: React.FC<ResultDisplayProps> = ({ result, isLoading, error }) => {
  // 결과 데이터의 유형에 따라 적절한 표시 방법 결정
  const renderResult = () => {
    if (!result) return null;

    // 결과가 배열인 경우
    if (Array.isArray(result)) {
      return (
        <div className="space-y-3">
          <h3 className="font-medium">Results ({result.length} items)</h3>
          <div className="max-h-96 overflow-y-auto">
            {result.map((item, index) => (
              <div key={index} className="p-3 bg-gray-50 rounded mb-2 border border-gray-200">
                {typeof item === 'object' 
                  ? <pre className="whitespace-pre-wrap">{JSON.stringify(item, null, 2)}</pre>
                  : <p>{String(item)}</p>
                }
              </div>
            ))}
          </div>
        </div>
      );
    }

    // 결과가 객체인 경우
    if (typeof result === 'object') {
      return (
        <div className="space-y-3">
          <h3 className="font-medium">Result</h3>
          <pre className="p-3 bg-gray-50 rounded border border-gray-200 max-h-96 overflow-y-auto whitespace-pre-wrap">
            {JSON.stringify(result, null, 2)}
          </pre>
        </div>
      );
    }

    // 결과가 문자열이나 기타 기본 타입인 경우
    return (
      <div className="space-y-3">
        <h3 className="font-medium">Result</h3>
        <div className="p-3 bg-gray-50 rounded border border-gray-200">
          <p className="whitespace-pre-wrap">{String(result)}</p>
        </div>
      </div>
    );
  };

  return (
    <div className="p-4 border border-gray-300 rounded-lg bg-white">
      <h2 className="text-lg font-medium mb-3">Execution Results</h2>
      
      {isLoading ? (
        <div className="flex items-center justify-center p-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
          <span className="ml-3">Processing workflow...</span>
        </div>
      ) : error ? (
        <div className="p-4 bg-red-50 border border-red-200 rounded text-red-600">
          <h3 className="font-medium mb-2">Error</h3>
          <p>{error}</p>
        </div>
      ) : result ? (
        renderResult()
      ) : (
        <p className="text-gray-500">No results to display. Run the workflow to see results here.</p>
      )}
    </div>
  );
};

export default ResultDisplay; 