import React, { useCallback, useState, useEffect } from 'react';
import { MergerNodeData } from '../../types/nodes';
import { NodeState } from '../../types/execution'; // Import NodeState type from the correct path
import { TrashIcon, PlusIcon, DocumentDuplicateIcon } from '@heroicons/react/24/outline'; // Or your icon library
import { useNodeContent } from '../../store/useNodeContentStore';

interface MergerNodeSidebarProps {
  nodeId: string;
  nodeData: MergerNodeData;
  nodeState: NodeState; // Add nodeState prop
}

export const MergerNodeSidebar: React.FC<MergerNodeSidebarProps> = ({ nodeId, nodeData, nodeState }) => {
  const { updateContent } = useNodeContent(nodeId);
  
  // State for editable custom items
  const [customItems, setCustomItems] = useState<string[]>(nodeData.items || []);

  // Get read-only execution results
  const executionResults: any[] = Array.isArray(nodeState.result) ? nodeState.result : [];

  // Update local custom items state if nodeData changes externally
  useEffect(() => {
    setCustomItems(nodeData.items || []);
  }, [nodeData.items]);

  // --- Handlers for Custom Items Section --- 
  const handleCustomItemChange = (index: number, value: string) => {
    const newItems = [...customItems];
    newItems[index] = value;
    setCustomItems(newItems);
    // Update nodeData in Zustand store
    updateContent({ items: newItems });
  };

  const handleAddCustomItem = () => {
    const newItems = [...customItems, '']; // Add an empty string
    setCustomItems(newItems);
    updateContent({ items: newItems });
  };

  const handleRemoveCustomItem = (index: number) => {
    const newItems = customItems.filter((_, i) => i !== index);
    setCustomItems(newItems);
    updateContent({ items: newItems });
  };
  
  // Optional: Copy execution results to custom items
  const copyResultsToCustom = useCallback(() => {
    const newCustomItems = executionResults.map(String); // Convert all results to string
    setCustomItems(newCustomItems);
    updateContent({ items: newCustomItems });
  }, [executionResults, updateContent]);

  return (
    <div className="p-4 space-y-6">
      {/* Section 1: Live Merged Execution Results (Read-only) */}
      <div className="space-y-2">
        <h3 className="text-md font-semibold text-gray-800 border-b pb-1 mb-2">Live Merged Results</h3>
        {nodeState.status === 'running' && <p className="text-sm text-blue-600">(Running...)</p>}
        {nodeState.status === 'error' && <p className="text-sm text-red-600">Error: {nodeState.error}</p>}
        {(nodeState.status === 'success' || nodeState.status === 'idle') && (
           executionResults.length > 0 ? (
            <div className="space-y-2">
              <pre className="text-xs font-mono bg-white border border-gray-300 rounded-lg p-3 overflow-auto max-h-[300px] whitespace-pre-wrap">
                {JSON.stringify(executionResults, null, 2)}
              </pre>
              <div className="flex justify-between items-center text-xs text-gray-500">
                <span>{executionResults.length} items</span>
                <span>{JSON.stringify(executionResults).length} chars</span>
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-400 italic">No execution results available.</p>
          )
        )}
      </div>

      {/* Section 2: Custom Items (Editable) */}
      <div className="space-y-2">
         <div className="flex justify-between items-center border-b pb-1 mb-2">
             <h3 className="text-md font-semibold text-gray-800">Custom Items</h3>
             <button 
                onClick={copyResultsToCustom}
                disabled={executionResults.length === 0}
                className="text-xs px-2 py-1 rounded bg-gray-100 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                title="Copy live results to custom items (will overwrite)"
             > <DocumentDuplicateIcon className="h-3 w-3"/> Copy Results</button>
         </div>
        <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
          {customItems.map((item, index) => (
            <div key={`custom-${index}`} className="flex items-center space-x-2">
              <textarea
                value={item}
                onChange={(e) => handleCustomItemChange(index, e.target.value)}
                rows={1} 
                // Ensure background is white/gray - Tailwind default is usually white
                className="flex-grow p-1.5 border border-gray-300 rounded text-sm font-mono resize-none focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white"
                placeholder={`Custom Item ${index + 1}`}
              />
              <span className="text-xs text-gray-500 whitespace-nowrap">
                {item.length} chars
              </span>
              <button 
                onClick={() => handleRemoveCustomItem(index)}
                className="p-1 text-gray-400 hover:text-red-600"
                title="Remove Item"
              >
                <TrashIcon className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
        <button
          onClick={handleAddCustomItem}
          className="w-full flex justify-center items-center mt-2 p-2 border-2 border-dashed border-gray-300 rounded text-gray-500 hover:border-indigo-500 hover:text-indigo-500 transition-colors"
        >
          <PlusIcon className="h-5 w-5 mr-1" />
          Add Custom Item
        </button>
      </div>
    </div>
  );
}; 