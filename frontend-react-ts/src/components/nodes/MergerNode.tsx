import React, { useState, useCallback, useEffect, Fragment } from 'react';
import { Handle, Position } from 'reactflow';
import { MergerNodeData } from '../../types/nodes';
import { useFlowStructureStore } from '../../store/useFlowStructureStore';
import { useMergerNodeData } from '../../hooks/useMergerNodeData';
import clsx from 'clsx';
import { useNodeState } from '../../store/useNodeStateStore';
import { ChevronDownIcon } from '@heroicons/react/24/solid';
import { Listbox, Transition } from '@headlessui/react';

// Type for props
interface MergerNodeProps {
  id: string;
  data: MergerNodeData;
  isConnectable: boolean;
  selected?: boolean;
}

// We need to extend MergerNodeData for runtime properties
interface RuntimeMergerNodeData extends MergerNodeData {
  property?: {
    separator?: string;
    [key: string]: any;
  };
}

const MAX_HANDLES = 6; // Maximum number of input handles to display

// Output format options with labels and values
const OUTPUT_FORMATS = [
  { label: 'Return as Array', value: 'array', description: 'Pass the full array as-is' },
  { label: 'Join with Separator', value: 'joinToString', description: 'Concatenate array items with a separator' },
  { label: 'Map to Object', value: 'object', description: 'Convert array into object using item keys' }
];

// Map old merge mode values to new output format values for backward compatibility
const legacyModeMapping: Record<string, string> = {
  'concat': 'array',
  'join': 'joinToString',
  'object': 'object'
};

const MergerNode: React.FC<MergerNodeProps> = ({ id, data, isConnectable, selected }) => {
  const { updateNode } = useFlowStructureStore(state => ({
    updateNode: state.updateNode
  }));
  
  // Access node state for status
  const nodeState = useNodeState(id);
  
  // Use the merger node data hook
  const { items, itemCount, resetItems } = useMergerNodeData({ nodeId: id });
  
  // Cast data to runtime type for property access
  const runtimeData = data as RuntimeMergerNodeData;
  
  // Map merge mode to output format
  const getInitialFormat = (): 'array' | 'joinToString' | 'object' => {
    if (!data.mergeMode) return 'array';
    return (legacyModeMapping[data.mergeMode] as 'array' | 'joinToString' | 'object') || 'array';
  };
  
  // Local state for output format
  const [outputFormat, setOutputFormat] = useState<'array' | 'joinToString' | 'object'>(getInitialFormat());
  
  // Get existing separator value or use default
  const initialSeparator = runtimeData.property?.separator || ', ';
  
  // Local state for separator
  const [separator, setSeparator] = useState<string>(initialSeparator);
  
  // Update state when props change
  useEffect(() => {
    if (data.mergeMode) {
      const mappedFormat = legacyModeMapping[data.mergeMode];
      if (mappedFormat && mappedFormat !== outputFormat) {
        setOutputFormat(mappedFormat as 'array' | 'joinToString' | 'object');
      }
    }
  }, [data.mergeMode, outputFormat]);
  
  // Handle output format change
  const handleOutputFormatChange = useCallback((format: 'array' | 'joinToString' | 'object') => {
    setOutputFormat(format);
    
    // Map new format value back to legacy value for storage
    const legacyValue = format === 'array' ? 'concat' : 
                         format === 'joinToString' ? 'join' : 'object';
    
    // Update the node data in Zustand store with legacy value for backward compatibility
    updateNode(id, (node) => {
      // Create a new node object to avoid mutating the original
      const updatedNode = { ...node };
      
      // Cast the data to our runtime type
      const nodeData = updatedNode.data as RuntimeMergerNodeData;
      
      // Update merge mode
      nodeData.mergeMode = legacyValue;
      
      // Ensure property object exists
      if (!nodeData.property) {
        nodeData.property = {};
      }
      
      // Update separator property for runtime use if join mode
      if (format === 'joinToString') {
        nodeData.property.separator = separator;
      }
      
      return updatedNode;
    });
  }, [id, updateNode, separator]);
  
  // Handle separator change
  const handleSeparatorChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newSeparator = e.target.value;
    setSeparator(newSeparator);
    
    // Directly update the property for runtime use
    updateNode(id, (node) => {
      // Create a new node object to avoid mutating the original
      const updatedNode = { ...node };
      
      // Cast the data to our runtime type
      const nodeData = updatedNode.data as RuntimeMergerNodeData;
      
      // Ensure property object exists
      if (!nodeData.property) {
        nodeData.property = {};
      }
      
      // Update the separator
      nodeData.property.separator = newSeparator;
      
      return updatedNode;
    });
  }, [id, updateNode]);

  // Handle reset button click
  const handleResetClick = useCallback(() => {
    console.log(`MergerNode(${id}): Reset button clicked`);
    resetItems();
  }, [id, resetItems]);

  // Get items preview (up to 3 recent items)
  const getItemsPreview = useCallback(() => {
    if (!items || items.length === 0) return null;
    
    const previewItems = items.slice(-3); // Get last 3 items
    
    return (
      <div className="w-full mt-2 p-2 bg-slate-50 dark:bg-slate-700/30 rounded text-xs">
        <div className="font-medium text-slate-700 dark:text-slate-200 mb-1">Recent items:</div>
        {previewItems.map((item, index) => (
          <div 
            key={index} 
            className="truncate text-slate-600 dark:text-slate-300 opacity-90 text-[10px]"
            title={typeof item === 'string' ? item : JSON.stringify(item)}
          >
            {typeof item === 'string' 
              ? (item.length > 25 ? `${item.substring(0, 25)}...` : item)
              : (JSON.stringify(item).length > 25 
                  ? `${JSON.stringify(item).substring(0, 25)}...` 
                  : JSON.stringify(item))
            }
          </div>
        ))}
        {items.length > 3 && (
          <div className="text-slate-500 dark:text-slate-400 italic text-[10px] mt-1">
            ...and {items.length - 3} more item(s)
          </div>
        )}
      </div>
    );
  }, [items]);

  return (
    <div className={clsx(
      "relative flex flex-col w-[220px] rounded-lg border-2 shadow-md p-3",
      selected 
        ? "bg-slate-50 dark:bg-slate-800 border-primary-500 dark:border-primary-500" 
        : "bg-white dark:bg-slate-700 border-slate-200 dark:border-slate-600"
    )}>
      {/* Generic "input" handle to ensure compatibility */}
      <Handle
        type="target"
        position={Position.Left}
        id="input"
        style={{ 
          top: '50%', 
          background: 'var(--color-primary-500)', 
          borderColor: 'var(--color-primary-600)',
          width: '10px',
          height: '10px',
          zIndex: 100
        }}
        isConnectable={isConnectable}
      />
      
      {/* Input handles - dynamically create based on connections */}
      {Array.from({ length: MAX_HANDLES }).map((_, i) => (
        <Handle
          key={`input-${i}`}
          type="target"
          position={Position.Left}
          id={`${id}-target-${i+1}`}
          style={{ 
            top: `${((i + 1) / (MAX_HANDLES + 1)) * 100}%`, 
            background: 'var(--color-primary-500)', 
            borderColor: 'var(--color-primary-600)' 
          }}
          isConnectable={isConnectable}
        />
      ))}
      
      {/* Output handle */}
      <Handle
        type="source"
        position={Position.Right}
        id={`${id}-source`}
        style={{ 
          top: '50%', 
          background: 'var(--color-primary-500)', 
          borderColor: 'var(--color-primary-600)' 
        }}
        isConnectable={isConnectable}
      />
      
      {/* Node content */}
      <div className="flex flex-col items-center w-full">
        <div className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-3 w-full flex justify-between items-center">
          <span>{data.label || 'Merger'}</span>
          <span className={clsx(
            "text-xs px-2 py-0.5 rounded-full",
            itemCount > 0
              ? "bg-primary-100 dark:bg-primary-800/40 text-primary-700 dark:text-primary-300" 
              : "bg-slate-100 dark:bg-slate-600/40 text-slate-500 dark:text-slate-300"
          )}>
            {itemCount} {itemCount === 1 ? 'item' : 'items'}
          </span>
        </div>
        
        {/* Output Format dropdown - using Headless UI Listbox */}
        <div className="w-full mb-3">
          <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
            Output Format
          </label>
          <Listbox value={outputFormat} onChange={handleOutputFormatChange}>
            <div className="relative">
              <Listbox.Button className="relative w-full px-3 py-1.5 text-xs rounded-md bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-500 shadow-sm flex justify-between items-center hover:border-primary-400 dark:hover:border-primary-400 focus:outline-none focus:ring-1 focus:ring-primary-500">
                <span>{OUTPUT_FORMATS.find(format => format.value === outputFormat)?.label}</span>
                <ChevronDownIcon className="h-3 w-3 text-slate-400 dark:text-slate-300" />
              </Listbox.Button>
              <Transition
                as={Fragment}
                leave="transition ease-in duration-100"
                leaveFrom="opacity-100"
                leaveTo="opacity-0"
              >
                <Listbox.Options className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-md bg-white dark:bg-slate-700 text-xs py-1 shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
                  {OUTPUT_FORMATS.map((format) => (
                    <Listbox.Option
                      key={format.value}
                      value={format.value}
                      className={({ active, selected }) =>
                        clsx(
                          "cursor-pointer select-none relative px-3 py-1.5",
                          active ? "bg-primary-50 dark:bg-primary-700/30 text-primary-700 dark:text-primary-200" : "text-slate-700 dark:text-slate-200",
                          selected && "bg-primary-50 dark:bg-primary-800/40"
                        )
                      }
                    >
                      {({ selected }) => (
                        <div>
                          <span className={clsx(
                            "block truncate",
                            selected ? "font-medium text-primary-700 dark:text-primary-300" : "font-normal"
                          )}>
                            {format.label}
                          </span>
                          <span className="block truncate text-[10px] text-slate-500 dark:text-slate-400">
                            {format.description}
                          </span>
                        </div>
                      )}
                    </Listbox.Option>
                  ))}
                </Listbox.Options>
              </Transition>
            </div>
          </Listbox>
        </div>
        
        {/* Separator input - only shown for Join with Separator format */}
        {outputFormat === 'joinToString' && (
          <div className="w-full mb-3">
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
              Separator
            </label>
            <input
              type="text"
              value={separator}
              onChange={handleSeparatorChange}
              className="w-full px-3 py-1.5 text-xs rounded-md bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-500 shadow-sm hover:border-primary-400 dark:hover:border-primary-400 focus:outline-none focus:ring-1 focus:ring-primary-500"
              placeholder="Enter separator"
            />
          </div>
        )}
        
        {/* Items management */}
        <div className="w-full mb-3">
          <div className="flex justify-between items-center mb-1">
            <label className="text-xs font-medium text-slate-600 dark:text-slate-300">
              Accumulated Items
            </label>
            
            {/* Reset button */}
            <button
              className={clsx(
                "px-2 py-0.5 text-xs rounded transition-colors border",
                itemCount > 0
                  ? "bg-white dark:bg-slate-700 text-primary-600 hover:bg-primary-50 border-primary-200 dark:text-primary-400 dark:hover:bg-primary-900/20 dark:border-primary-800/30"
                  : "bg-white dark:bg-slate-700 text-slate-400 border-slate-200 dark:text-slate-400 dark:border-slate-600 cursor-not-allowed opacity-50"
              )}
              onClick={handleResetClick}
              disabled={itemCount === 0}
            >
              Reset
            </button>
          </div>
          
          {/* Items preview */}
          {itemCount > 0 ? getItemsPreview() : (
            <div className="w-full p-2 bg-slate-50 dark:bg-slate-700/30 rounded text-xs text-slate-400 dark:text-slate-400 italic">
              No items accumulated yet
            </div>
          )}
        </div>
        
        {/* Node status indicator */}
        {nodeState && (
          <div className={clsx(
            "mt-1 text-xs px-2 py-1 rounded-full w-full text-center",
            nodeState.status === 'running' && "bg-blue-50 dark:bg-blue-800/30 text-blue-600 dark:text-blue-300",
            nodeState.status === 'success' && "bg-green-50 dark:bg-green-800/30 text-green-600 dark:text-green-300",
            nodeState.status === 'error' && "bg-red-50 dark:bg-red-800/30 text-red-600 dark:text-red-300",
            nodeState.status === 'idle' && "bg-slate-50 dark:bg-slate-700/30 text-slate-500 dark:text-slate-300"
          )}>
            {nodeState.status === 'running' && 'Processing...'}
            {nodeState.status === 'success' && 'Success'}
            {nodeState.status === 'error' && 'Error'}
            {nodeState.status === 'idle' && 'Ready'}
          </div>
        )}
      </div>
    </div>
  );
};

export default MergerNode; 