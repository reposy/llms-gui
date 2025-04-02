import React, { useCallback } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { useDispatch } from 'react-redux';
import { updateNodeData } from '../../store/flowSlice';
import { MergerNodeData } from '../../types/nodes';
import { useNodeState } from '../../store/flowExecutionStore'; // Import useNodeState
import NodeErrorBoundary from './NodeErrorBoundary';
import { NodeHeader } from './shared/NodeHeader';
import { NodeBody } from './shared/NodeBody';
import { NodeFooter } from './shared/NodeFooter';
import clsx from 'clsx';

const MergerNode: React.FC<NodeProps<MergerNodeData>> = ({ id, data, selected }) => {
  const dispatch = useDispatch();
  const nodeState = useNodeState(id); // Get the execution state

  const handleLabelUpdate = useCallback((newLabel: string) => {
    dispatch(updateNodeData({ nodeId: id, data: { ...data, label: newLabel } }));
  }, [dispatch, id, data]);

  // Get the merged results array from the node state
  const mergedResults: any[] = Array.isArray(nodeState.result) ? nodeState.result : [];
  const totalResults = mergedResults.length;
  // Limit preview to avoid overwhelming the UI, but maybe show more than 3? Let's try 5.
  const previewResults = mergedResults.slice(0, 5); 

  return (
    <NodeErrorBoundary nodeId={id}>
      <div className={clsx("flex flex-col rounded-lg border bg-white shadow-lg", selected ? 'border-indigo-500' : 'border-gray-300', 'w-[300px]')}> 
        {/* Input Handle (allow multiple connections) */}
        <Handle 
          type="target" 
          position={Position.Left} 
          id="input"
          className="w-3 h-3 !bg-gray-500"
          style={{ top: '50%' }}
          isConnectable={true} // Explicitly allow connections
        />

        <NodeHeader 
          nodeId={id} 
          label={data.label || 'Merger'} 
          placeholderLabel="Merger Node"
          isRunning={nodeState?.status === 'running'}
          themeColor="purple" // Use purple theme
          onLabelUpdate={handleLabelUpdate}
          // Add dummy props needed by NodeHeader
          isRootNode={false} 
          viewMode="expanded"
          onRun={() => {}} // Merger runs based on input, no manual run button needed
          onToggleView={() => {}} 
        />
        <NodeBody>
          <div className="space-y-1">
            <div className="text-xs font-medium text-gray-600 mb-1">
              Merged Results ({totalResults} items)
            </div>
            {totalResults > 0 ? (
              <ul className="text-xs space-y-1 font-mono bg-gray-50 p-1 border rounded max-h-[100px] overflow-y-auto"> {/* Increased max height */}
                {previewResults.map((item, index) => {
                  // Determine how to display the item
                  let displayString: string;
                  if (typeof item === 'object' && item !== null) {
                    try {
                      displayString = JSON.stringify(item, null, 2); // Pretty print JSON
                    } catch (e) {
                      console.error("Error stringifying object in MergerNode:", e);
                      displayString = '[Error displaying object]'; // Fallback for stringify error
                    }
                  } else {
                    displayString = String(item); // Default string conversion
                  }
                  
                  return (
                    // Use pre-wrap to preserve JSON formatting, truncate for single lines
                    <li key={index} 
                        className={typeof item === 'object' && item !== null ? "whitespace-pre-wrap" : "truncate"} 
                        title={displayString} // Tooltip shows full content
                    >
                      {displayString} 
                    </li>
                  );
                })}
                {totalResults > previewResults.length && ( // Show count if more items exist
                  <li className="text-gray-400">... ({totalResults - previewResults.length} more items)</li>
                )}
              </ul>
            ) : (
              <p className="text-xs text-gray-400 italic">Waiting for input...</p>
            )}
             {nodeState.status === 'error' && (
               <p className="text-xs text-red-500 mt-1">Error: {nodeState.error}</p>
             )}
          </div>
        </NodeBody>
        <NodeFooter>
          {/* Output Handle */}
          <Handle 
            type="source" 
            position={Position.Right} 
            id="output"
            className="w-3 h-3 !bg-purple-500"
          />
          <p className="text-xs text-gray-500">Output (Array)</p>
        </NodeFooter>
      </div>
    </NodeErrorBoundary>
  );
};

export default MergerNode; 