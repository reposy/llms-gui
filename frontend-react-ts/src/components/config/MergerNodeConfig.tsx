import React, { useCallback, useState } from 'react';
import { MergerNodeData } from '../../types/nodes';
import { useNodeState } from '../../store/useNodeStateStore';
import { useMergerNodeData } from '../../hooks/useMergerNodeData';
import { DocumentDuplicateIcon } from '@heroicons/react/24/outline';

interface MergerNodeConfigProps {
  nodeId: string;
  data: MergerNodeData;
}

// We need to extend MergerNodeData for runtime properties
interface RuntimeMergerNodeData extends MergerNodeData {
  property?: {
    separator?: string;
    [key: string]: any;
  };
}

// Map old merge mode values to new output format values for backward compatibility
const legacyModeMapping: Record<string, string> = {
  'concat': 'array',
  'join': 'joinToString',
  'object': 'object'
};

// Reverse mapping for display purposes
const formatDisplayNames: Record<string, string> = {
  'array': 'Return as Array',
  'joinToString': 'Join with Separator',
  'object': 'Map to Object'
};

// Label component
const ConfigLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
    {children}
  </label>
);

export const MergerNodeConfig: React.FC<MergerNodeConfigProps> = ({ nodeId, data }) => {
  console.log(`[MergerNodeConfig] Rendering for node ID: ${nodeId}`);
  
  const nodeState = useNodeState(nodeId);
  const { items, itemCount, resetItems } = useMergerNodeData({ nodeId });
  
  // Get merge mode from data and convert to our format nomenclature
  const runtimeData = data as RuntimeMergerNodeData;
  const outputFormat = legacyModeMapping[data.mergeMode || 'concat'] || 'array';
  const separator = runtimeData.property?.separator || ', ';
  
  // Local state for copy feedback
  const [showCopied, setShowCopied] = useState(false);
  
  // Generate the joined result for joinToString mode
  const joinedResult = outputFormat === 'joinToString' && items.length > 0
    ? items.join(separator)
    : '';
  
  // Handle copy to clipboard
  const handleCopyToClipboard = useCallback(() => {
    if (joinedResult) {
      navigator.clipboard.writeText(joinedResult)
        .then(() => {
          setShowCopied(true);
          setTimeout(() => setShowCopied(false), 2000);
        })
        .catch(err => {
          console.error('Failed to copy text: ', err);
        });
    }
  }, [joinedResult]);
  
  // Handle reset button click
  const handleResetItems = useCallback(() => {
    resetItems();
  }, [resetItems]);

  return (
    <div className="space-y-4">
      {/* Output Format Display */}
      <div>
        <ConfigLabel>Output Format</ConfigLabel>
        <div className="p-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md text-slate-700 dark:text-slate-300">
          {formatDisplayNames[outputFormat] || 'Return as Array'}
        </div>
      </div>
      
      {/* Separator Display (if applicable) */}
      {outputFormat === 'joinToString' && (
        <div>
          <ConfigLabel>Separator</ConfigLabel>
          <div className="p-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md text-slate-700 dark:text-slate-300 font-mono">
            "{separator}"
          </div>
        </div>
      )}
      
      {/* Item Count & Reset Button */}
      <div>
        <div className="flex justify-between items-center mb-1">
          <ConfigLabel>Accumulated Items</ConfigLabel>
          <div className="flex items-center space-x-2">
            <span className="text-xs text-slate-500 dark:text-slate-400">
              {itemCount} {itemCount === 1 ? 'item' : 'items'}
            </span>
            <button
              className={`px-2 py-0.5 text-xs rounded transition-colors border ${
                itemCount > 0
                  ? "bg-white dark:bg-slate-700 text-primary-600 hover:bg-primary-50 border-primary-200 dark:text-primary-400 dark:hover:bg-primary-900/20 dark:border-primary-800/30"
                  : "bg-white dark:bg-slate-700 text-slate-400 border-slate-200 dark:text-slate-400 dark:border-slate-600 cursor-not-allowed opacity-50"
              }`}
              onClick={handleResetItems}
              disabled={itemCount === 0}
            >
              Reset
            </button>
          </div>
        </div>
        
        {/* Items Display */}
        <div className="overflow-auto max-h-[200px] border border-slate-200 dark:border-slate-700 rounded-md">
          {itemCount > 0 ? (
            <ul className="divide-y divide-slate-200 dark:divide-slate-700">
              {items.map((item, index) => (
                <li key={index} className="p-2 text-sm text-slate-600 dark:text-slate-300 font-mono truncate hover:bg-slate-50 dark:hover:bg-slate-800/50">
                  <span className="text-xs text-slate-400 dark:text-slate-500 mr-2">{index + 1}:</span>
                  {typeof item === 'string' 
                    ? item 
                    : JSON.stringify(item)}
                </li>
              ))}
            </ul>
          ) : (
            <div className="p-3 text-center text-slate-400 dark:text-slate-500 italic text-sm">
              No items accumulated yet
            </div>
          )}
        </div>
      </div>
      
      {/* Joined Result (if applicable) */}
      {outputFormat === 'joinToString' && (
        <div>
          <div className="flex justify-between items-center mb-1">
            <ConfigLabel>Joined Result</ConfigLabel>
            <button
              className={`px-2 py-0.5 text-xs rounded transition-colors border flex items-center space-x-1 ${
                joinedResult
                  ? "bg-white dark:bg-slate-700 text-primary-600 hover:bg-primary-50 border-primary-200 dark:text-primary-400 dark:hover:bg-primary-900/20 dark:border-primary-800/30"
                  : "bg-white dark:bg-slate-700 text-slate-400 border-slate-200 dark:text-slate-400 dark:border-slate-600 cursor-not-allowed opacity-50"
              }`}
              onClick={handleCopyToClipboard}
              disabled={!joinedResult}
            >
              <DocumentDuplicateIcon className="h-3 w-3" />
              <span>{showCopied ? 'Copied!' : 'Copy'}</span>
            </button>
          </div>
          <div className="p-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md text-slate-700 dark:text-slate-300 font-mono text-sm overflow-auto max-h-[150px] whitespace-pre-wrap">
            {joinedResult || <span className="italic text-slate-400 dark:text-slate-500">No joined result available</span>}
          </div>
        </div>
      )}
      
      {/* Node Status */}
      {nodeState && (
        <div className="mt-2">
          <div className={`px-3 py-2 rounded-full text-xs text-center ${
            nodeState.status === 'running' ? "bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-300" :
            nodeState.status === 'success' ? "bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-300" :
            nodeState.status === 'error' ? "bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-300" :
            "bg-slate-50 dark:bg-slate-700/30 text-slate-500 dark:text-slate-300"
          }`}>
            {nodeState.status === 'running' && 'Processing...'}
            {nodeState.status === 'success' && 'Success'}
            {nodeState.status === 'error' && `Error: ${nodeState.error}`}
            {nodeState.status === 'idle' && 'Ready'}
          </div>
        </div>
      )}
    </div>
  );
}; 