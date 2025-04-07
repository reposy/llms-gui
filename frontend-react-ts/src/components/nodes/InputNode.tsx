import React, { useCallback, useState, ChangeEvent, useEffect } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { useDispatch } from 'react-redux';
import { updateNodeData } from '../../store/flowSlice';
import { InputNodeData } from '../../types/nodes';
import NodeErrorBoundary from './NodeErrorBoundary';
import { NodeHeader } from './shared/NodeHeader';
import { NodeBody } from './shared/NodeBody';
import { NodeFooter } from './shared/NodeFooter';
import clsx from 'clsx';
import { executeFlow, useNodeState } from '../../store/flowExecutionStore';

const InputNode: React.FC<NodeProps<InputNodeData>> = ({ id, data, selected }) => {
  const dispatch = useDispatch();
  // Use local state to manage textarea value derived from props initially
  const [currentText, setCurrentText] = useState(data.text || '');
  const [fileName, setFileName] = useState<string | null>(null);
  
  // Get node execution state
  const nodeState = useNodeState(id);
  const isRunning = nodeState.status === 'running';

  // Update local state if the node data changes externally
  useEffect(() => {
    setCurrentText(data.text || '');
    // Potentially derive filename from items if needed, but might be complex
  }, [data.text]);

  // Handle configuration changes
  const handleConfigChange = useCallback((updates: Partial<InputNodeData>) => {
    dispatch(updateNodeData({
      nodeId: id,
      data: { ...data, ...updates }
    }));
  }, [dispatch, id, data]);

  const handleLabelUpdate = useCallback((newLabel: string) => {
    handleConfigChange({ label: newLabel });
  }, [handleConfigChange]);

  const handleTextChange = useCallback((event: ChangeEvent<HTMLTextAreaElement>) => {
    const newText = event.target.value;
    setCurrentText(newText);
    handleConfigChange({ 
      text: newText, 
      inputType: 'text', // Explicitly set type to text on manual edit
      items: [] // Clear items if text is manually edited
    });
  }, [handleConfigChange]);

  const handleTypeChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const newType = event.target.value as 'text' | 'file';
    
    // Clear other input types when switching
    if (newType === 'text') {
      handleConfigChange({ 
        inputType: newType,
        items: [] 
      });
      setFileName(null);
    } else {
      handleConfigChange({ 
        inputType: newType,
        text: '' 
      });
      setCurrentText('');
    }
  }, [handleConfigChange]);

  const handleIterateEachRowChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const checked = event.target.checked;
    handleConfigChange({ iterateEachRow: checked });
  }, [handleConfigChange]);

  const handleFileChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setFileName(file.name);
      const reader = new FileReader();
      reader.onload = (e) => {
        const fileContent = e.target?.result as string;
        // Split by lines, trim whitespace, and filter out empty lines
        const lines = fileContent.split(/\r?\n/).map(line => line.trim()).filter(line => line !== '');
        handleConfigChange({ 
          items: lines, 
          inputType: 'list', // Set type to list after processing file
          text: '' // Clear text field
        });
        setCurrentText(''); // Clear local text state
      };
      reader.onerror = (e) => {
        console.error("Error reading file:", e);
        setFileName('Error reading file');
        handleConfigChange({ items: [], inputType: 'file' });
      };
      reader.readAsText(file);
    }
  }, [handleConfigChange]);

  // Add handler for running the input node
  const handleRunNode = useCallback(() => {
    console.log(`Running input node: ${id}`);
    executeFlow(id);
  }, [id]);

  // Derive current input type from data, default to text
  const currentInputType = data.inputType || 'text';
  
  // Always show iterateEachRow option for file/list inputs
  const showIterateOption = currentInputType === 'file' || currentInputType === 'list';

  return (
    <NodeErrorBoundary nodeId={id}>
      <div className={clsx("relative flex flex-col rounded-lg border bg-white shadow-lg", selected ? 'border-blue-500' : 'border-gray-300', 'w-[350px]')}>
        <NodeHeader 
          nodeId={id} 
          label={data.label || 'Input'} 
          placeholderLabel="Input Node"
          isRootNode={true} // Input nodes are often roots
          isRunning={isRunning} // Update to check actual running state
          viewMode="expanded" // Always expanded for input?
          themeColor="gray"
          onRun={handleRunNode} // Add the run handler
          onLabelUpdate={handleLabelUpdate}
          onToggleView={() => {}} // No view toggle for basic input
        />
        <Handle 
          type="source" 
          position={Position.Right} 
          id="output"
          className="w-3 h-3 !bg-gray-500"
          style={{ position: 'absolute', top: '50%', transform: 'translateY(-50%)', right: '-6px', zIndex: 50 }}
        />
        <NodeBody>
          {/* Input Type Selection */}
          <div className="mb-2 flex space-x-4">
            <label className="flex items-center">
              <input 
                type="radio" 
                name={`inputType-${id}`}
                value="text"
                checked={currentInputType === 'text'}
                onChange={handleTypeChange}
                className="mr-1"
              /> Text Input
            </label>
            <label className="flex items-center">
              <input 
                type="radio" 
                name={`inputType-${id}`}
                value="file"
                checked={currentInputType === 'file' || currentInputType === 'list'} // Show file selected if file or list
                onChange={handleTypeChange}
                className="mr-1"
              /> File Input
            </label>
          </div>

          {/* Conditional Input Area */}
          {currentInputType === 'text' && (
            <textarea
              value={currentText} // Use local state for controlled component
              onChange={handleTextChange}
              className="nodrag nowheel w-full h-32 p-2 border border-gray-300 rounded text-sm font-mono focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none bg-white text-black"
              placeholder="Enter text here..."
            />
          )}
          {(currentInputType === 'file' || currentInputType === 'list') && (
            <div className="nodrag">
              <input 
                type="file"
                onChange={handleFileChange}
                className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
              />
              {/* Display file info or item count */} 
              {(fileName || (data.items && data.items.length > 0)) && (
                <p className="mt-2 text-xs text-gray-600">
                  {currentInputType === 'list' 
                    ? `${data.items?.length || 0} items loaded ${fileName ? `(from ${fileName})` : ''}` 
                    : (fileName ? `Selected: ${fileName}` : 'Select a text file (.txt, .csv, etc.)')}
                </p>
              )}
              
              {/* Show iteration option for file/list inputs */}
              <div className="mt-3 flex items-center p-2 bg-gray-50 rounded">
                <input
                  type="checkbox"
                  id={`iterate-rows-${id}`}
                  checked={!!data.iterateEachRow}
                  onChange={handleIterateEachRowChange}
                  className="mr-2 h-4 w-4 text-blue-600 rounded focus:ring-blue-500"
                />
                <label htmlFor={`iterate-rows-${id}`} className="text-sm text-gray-700">
                  Process each row separately (Foreach mode)
                </label>
              </div>
            </div>
          )}
        </NodeBody>
        <NodeFooter>
          <p className="text-xs text-gray-500">
            {data.iterateEachRow 
              ? "Output (Foreach Row)" 
              : "Output (Text/List)"}
          </p>
          {/* Show iteration progress badge if available */}
          {data.iterateEachRow && data.iterationStatus && (
            <div className="ml-2 px-2 py-0.5 bg-blue-100 rounded-full text-xs text-blue-800">
              {data.iterationStatus.completed 
                ? "Completed" 
                : `${data.iterationStatus.currentIndex + 1}/${data.iterationStatus.totalItems}`}
            </div>
          )}
        </NodeFooter>
      </div>
    </NodeErrorBoundary>
  );
};

export default InputNode; 