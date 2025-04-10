import React, { useState, useEffect } from 'react';
import { MergerNodeData } from '../../types/nodes';
import { NodeState } from '../../types/execution';
import { useFlowStructureStore } from '../../store/useFlowStructureStore';
import { createRowByRowPreview, hasMoreItems } from '../../utils/previewUtils';
import { ClipboardDocumentIcon, CheckIcon } from '@heroicons/react/24/outline';

interface MergerNodeSidebarProps {
  nodeId: string;
  nodeData: MergerNodeData;
  nodeState: NodeState;
}

// Maximum rows to show in the sidebar preview before scrolling
const MAX_PREVIEW_ROWS = 200;
// Minimum visible rows before showing "Show more" button
const MIN_VISIBLE_ROWS = 5;

export const MergerNodeSidebar: React.FC<MergerNodeSidebarProps> = ({ nodeId, nodeData, nodeState }) => {
  const { updateNode } = useFlowStructureStore(state => ({
    updateNode: state.updateNode
  }));
  
  // Local state for all merger node settings
  const [mergeMode, setMergeMode] = useState<'concat' | 'join' | 'object'>(
    nodeData.mergeMode || 'concat'
  );
  const [joinSeparator, setJoinSeparator] = useState<string>(
    nodeData.joinSeparator || ' '
  );
  const [propertyNames, setPropertyNames] = useState<string[]>(
    nodeData.propertyNames || []
  );
  // State to track whether to show all rows
  const [showAllRows, setShowAllRows] = useState<boolean>(false);
  // State to track which copy button was clicked
  const [copyingJson, setCopyingJson] = useState<boolean>(false);
  const [copyingRows, setCopyingRows] = useState<boolean>(false);

  // Get read-only execution results
  const executionResults: any[] = Array.isArray(nodeState.result) ? nodeState.result : [];
  
  // Generate row-by-row preview
  const allRowItems = createRowByRowPreview(nodeState.result, MAX_PREVIEW_ROWS);
  const hasMoreRowItems = hasMoreItems(nodeState.result, MAX_PREVIEW_ROWS);
  
  // Determine how many rows to display based on showAllRows state
  const visibleRowItems = showAllRows 
    ? allRowItems 
    : allRowItems.slice(0, Math.min(MIN_VISIBLE_ROWS, allRowItems.length));
  const hiddenRowCount = allRowItems.length - visibleRowItems.length;

  // Update local state when node data changes externally
  useEffect(() => {
    setMergeMode(nodeData.mergeMode || 'concat');
    setJoinSeparator(nodeData.joinSeparator || ' ');
    setPropertyNames(nodeData.propertyNames || []);
  }, [nodeData]);

  // --- Handlers for settings updates ---
  
  // Update merge mode
  const handleMergeModeChange = (newMode: 'concat' | 'join' | 'object') => {
    setMergeMode(newMode);
    updateNode(nodeId, (node) => ({
      ...node,
      data: {
        ...node.data,
        mergeMode: newMode
      }
    }));
  };

  // Update join separator
  const handleJoinSeparatorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setJoinSeparator(value);
    updateNode(nodeId, (node) => ({
      ...node,
      data: {
        ...node.data,
        joinSeparator: value
      }
    }));
  };

  // Update property name for object mode
  const handlePropertyNameChange = (index: number, value: string) => {
    const newProps = [...propertyNames];
    newProps[index] = value;
    
    // Fill any gaps with numbered properties
    while (newProps.length <= index) {
      newProps.push(`prop${newProps.length + 1}`);
    }
    
    setPropertyNames(newProps);
    updateNode(nodeId, (node) => ({
      ...node,
      data: {
        ...node.data,
        propertyNames: newProps
      }
    }));
  };

  // Toggle showing all rows
  const toggleShowAllRows = () => {
    setShowAllRows(!showAllRows);
  };
  
  // Copy JSON to clipboard
  const copyJsonToClipboard = async () => {
    if (!nodeState.result) return;
    
    try {
      await navigator.clipboard.writeText(JSON.stringify(nodeState.result, null, 2));
      setCopyingJson(true);
      setTimeout(() => setCopyingJson(false), 2000);
    } catch (err) {
      console.error("Failed to copy JSON: ", err);
    }
  };
  
  // Copy rows to clipboard
  const copyRowsToClipboard = async () => {
    if (allRowItems.length === 0) return;
    
    try {
      await navigator.clipboard.writeText(allRowItems.join('\n'));
      setCopyingRows(true);
      setTimeout(() => setCopyingRows(false), 2000);
    } catch (err) {
      console.error("Failed to copy rows: ", err);
    }
  };

  return (
    <div className="p-4 space-y-6">
      <div className="space-y-2">
        <h3 className="text-lg font-semibold text-gray-800 border-b pb-1 mb-3">Merger Settings</h3>
        
        {/* Merge Mode Selection */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700">Merge Mode</label>
          <div className="flex items-center space-x-4">
            <button
              onClick={() => handleMergeModeChange('concat')}
              className={`w-12 h-8 rounded-md ${mergeMode === 'concat' ? 'bg-indigo-600 text-white' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'}`}
            >
              <span className="text-sm">Concat</span>
            </button>
            <button
              onClick={() => handleMergeModeChange('join')}
              className={`w-12 h-8 rounded-md ${mergeMode === 'join' ? 'bg-indigo-600 text-white' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'}`}
            >
              <span className="text-sm">Join</span>
            </button>
            <button
              onClick={() => handleMergeModeChange('object')}
              className={`w-12 h-8 rounded-md ${mergeMode === 'object' ? 'bg-indigo-600 text-white' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'}`}
            >
              <span className="text-sm">Object</span>
            </button>
          </div>
          
          {/* Helper text about auto-flattening */}
          <p className="text-xs text-gray-500 mt-1 italic">
            All inputs are automatically flattened
          </p>
          
          {/* Description based on selected mode */}
          <p className="text-xs text-gray-500 mt-1">
            {mergeMode === 'concat' && 'Concatenates all input arrays into one flat array.'}
            {mergeMode === 'join' && 'Joins text inputs into a single string using the specified separator.'}
            {mergeMode === 'object' && 'Combines inputs into an object using provided property names.'}
          </p>
        </div>
        
        {/* Join Separator (only for join mode) */}
        {mergeMode === 'join' && (
          <div className="space-y-1 mt-4">
            <label htmlFor="joinSeparator" className="text-sm font-medium text-gray-700">
              Join Separator
            </label>
            <input
              id="joinSeparator"
              type="text"
              value={joinSeparator}
              onChange={handleJoinSeparatorChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              placeholder="Enter separator (space, comma, etc.)"
            />
            <p className="text-xs text-gray-500">
              Examples: " " (space), "," (comma), "|", "\n" (new line)
            </p>
          </div>
        )}
        
        {/* Object Mode Property Names */}
        {mergeMode === 'object' && (
          <div className="space-y-2 mt-4">
            <label className="text-sm font-medium text-gray-700">
              Property Names
            </label>
            <p className="text-xs text-gray-500">
              Define custom keys for each input. Empty keys will use defaults.
            </p>
            <div className="space-y-2 max-h-32 overflow-y-auto">
              {Array.from({ length: Math.max(3, propertyNames.length + 1) }).map((_, index) => (
                <div key={`prop-${index}`} className="flex items-center space-x-2">
                  <div className="w-8 text-xs text-gray-500 text-right">{`#${index + 1}`}</div>
                  <input
                    type="text"
                    value={propertyNames[index] || ''}
                    onChange={(e) => handlePropertyNameChange(index, e.target.value)}
                    className="flex-grow px-3 py-1 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                    placeholder={`prop${index + 1}`}
                  />
                </div>
              ))}
            </div>
          </div>
        )}
        
        {/* Execution Result Previews */}
        {nodeState.result && (
          <div className="space-y-4 mt-6 pt-4 border-t border-gray-200">
            <h4 className="text-sm font-medium text-gray-700">Execution Results</h4>
            
            {/* JSON Preview */}
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="text-xs font-medium text-gray-700">
                  JSON Data
                </label>
                <button
                  onClick={copyJsonToClipboard}
                  className="inline-flex items-center text-xs text-gray-600 hover:text-indigo-600 transition-colors"
                  title="Copy JSON to clipboard"
                >
                  {copyingJson ? (
                    <>
                      <CheckIcon className="h-4 w-4 mr-1 text-green-500" /> Copied!
                    </>
                  ) : (
                    <>
                      <ClipboardDocumentIcon className="h-4 w-4 mr-1" /> Copy
                    </>
                  )}
                </button>
              </div>
              <div className="max-h-40 overflow-y-auto p-3 bg-gray-50 rounded-md border border-gray-300">
                <pre className="text-xs text-gray-700 whitespace-pre-wrap">
                  {JSON.stringify(nodeState.result, null, 2)}
                </pre>
              </div>
              {Array.isArray(nodeState.result) && (
                <div className="mt-1 text-xs text-gray-500 flex justify-between">
                  <span>{nodeState.result.length} total items</span>
                  <span>{JSON.stringify(nodeState.result).length} characters</span>
                </div>
              )}
            </div>
            
            {/* Row-by-Row Preview */}
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="text-xs font-medium text-gray-700">Each Row</label>
                <div className="flex items-center space-x-4">
                  {hiddenRowCount > 0 && (
                    <button 
                      onClick={toggleShowAllRows}
                      className="text-xs text-indigo-600 hover:text-indigo-800"
                    >
                      {showAllRows ? 'Show less' : `Show all ${allRowItems.length} rows`}
                    </button>
                  )}
                  {allRowItems.length > 0 && (
                    <button
                      onClick={copyRowsToClipboard}
                      className="inline-flex items-center text-xs text-gray-600 hover:text-indigo-600 transition-colors"
                      title="Copy all rows to clipboard"
                    >
                      {copyingRows ? (
                        <>
                          <CheckIcon className="h-4 w-4 mr-1 text-green-500" /> Copied!
                        </>
                      ) : (
                        <>
                          <ClipboardDocumentIcon className="h-4 w-4 mr-1" /> Copy
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>
              <div className="max-h-60 overflow-y-auto p-3 bg-gray-50 rounded-md border border-gray-300">
                {visibleRowItems.length > 0 ? (
                  <div className="space-y-1 font-mono text-xs">
                    {visibleRowItems.map((row, index) => (
                      <div key={`full-row-${index}`} className="py-0.5 hover:bg-gray-100 rounded px-1 transition duration-150 ease-in-out">
                        {row}
                      </div>
                    ))}
                    {hiddenRowCount > 0 && !showAllRows && (
                      <div className="text-xs text-gray-500 italic border-t border-gray-200 pt-2 mt-1">
                        {hiddenRowCount} more rows hidden. Click "Show all" to view.
                      </div>
                    )}
                    {hasMoreRowItems && (
                      <div className="text-xs text-gray-500 italic border-t border-gray-200 pt-2 mt-1">
                        {showAllRows && nodeState.result.length > MAX_PREVIEW_ROWS &&
                          `${nodeState.result.length - MAX_PREVIEW_ROWS} additional rows omitted for performance.`
                        }
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-xs text-gray-500 italic">
                    No items to display
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}; 