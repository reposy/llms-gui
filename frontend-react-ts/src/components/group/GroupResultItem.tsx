import React from 'react';
import { GroupExecutionItemResult } from '../../types/execution';

interface GroupResultItemProps {
  result: GroupExecutionItemResult;
  index: number;
}

export const GroupResultItem: React.FC<GroupResultItemProps> = ({ result, index }) => {
  return (
    <details className="p-2 border rounded-md bg-gray-50 text-sm">
      <summary className="cursor-pointer flex justify-between items-center">
        <span className="font-mono truncate flex-1 mr-2" title={String(result.item)}>
          Item {index + 1}: {String(result.item).substring(0, 50)}{String(result.item).length > 50 ? '...' : ''}
        </span>
        {result.status === 'success' ? (
          <span className="text-xs px-1.5 py-0.5 rounded bg-green-100 text-green-700">Success</span>
        ) : (
          <span className="text-xs px-1.5 py-0.5 rounded bg-red-100 text-red-700">Error</span>
        )}
      </summary>
      <div className="mt-2 pt-2 border-t text-xs space-y-1">
        {result.status === 'error' && (
          <p className="text-red-600">Error: {result.error}</p>
        )}
        <p>
          <span className="font-medium">Branch:</span> {result.conditionalBranch || 'N/A'}
        </p>
        <p className="font-medium">Final Output:</p>
        <pre className="p-1 bg-white border rounded text-xs font-mono max-h-24 overflow-auto">
          {result.finalOutput === null 
            ? 'null' 
            : typeof result.finalOutput === 'object' 
              ? JSON.stringify(result.finalOutput, null, 2) 
              : String(result.finalOutput)}
        </pre>
      </div>
    </details>
  );
};

export default GroupResultItem; 