import React, { useCallback, useState, ChangeEvent, useEffect } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { useDispatch, useSelector } from 'react-redux';
import { updateNodeData } from '../../store/flowSlice';
import { InputNodeData } from '../../types/nodes';
import { RootState } from '../../store/store';
import NodeErrorBoundary from './NodeErrorBoundary';
import { NodeHeader } from './shared/NodeHeader';
import { NodeBody } from './shared/NodeBody';
import { NodeFooter } from './shared/NodeFooter';
import clsx from 'clsx';

const InputNode: React.FC<NodeProps<InputNodeData>> = ({ id, data, selected }) => {
  const dispatch = useDispatch();
  // Use local state to manage textarea value derived from props initially
  const [currentText, setCurrentText] = useState(data.text || '');
  const [fileName, setFileName] = useState<string | null>(null);

  // Update local state if the node data changes externally
  useEffect(() => {
    setCurrentText(data.text || '');
    // Potentially derive filename from items if needed, but might be complex
  }, [data.text]);

  const handleLabelUpdate = useCallback((newLabel: string) => {
    dispatch(updateNodeData({ nodeId: id, data: { label: newLabel } }));
  }, [dispatch, id]);

  const handleTextChange = useCallback((event: ChangeEvent<HTMLTextAreaElement>) => {
    const newText = event.target.value;
    setCurrentText(newText);
    dispatch(updateNodeData({ 
      nodeId: id, 
      data: { 
        text: newText, 
        inputType: 'text', // Explicitly set type to text on manual edit
        items: [] // Clear items if text is manually edited
      } 
    }));
  }, [dispatch, id]);

  const handleTypeChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const newType = event.target.value as 'text' | 'file';
    dispatch(updateNodeData({ nodeId: id, data: { inputType: newType } }));
    // Clear other input types when switching
    if (newType === 'text') {
      dispatch(updateNodeData({ nodeId: id, data: { items: [] } }));
      setFileName(null);
    } else {
      dispatch(updateNodeData({ nodeId: id, data: { text: '' } }));
      setCurrentText('');
    }
  }, [dispatch, id]);

  const handleFileChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setFileName(file.name);
      const reader = new FileReader();
      reader.onload = (e) => {
        const fileContent = e.target?.result as string;
        // Split by lines, trim whitespace, and filter out empty lines
        const lines = fileContent.split(/\r?\n/).map(line => line.trim()).filter(line => line !== '');
        dispatch(updateNodeData({ 
          nodeId: id, 
          data: { 
            items: lines, 
            inputType: 'list', // Set type to list after processing file
            text: '' // Clear text field
          } 
        }));
        setCurrentText(''); // Clear local text state
      };
      reader.onerror = (e) => {
        console.error("Error reading file:", e);
        setFileName('Error reading file');
        dispatch(updateNodeData({ nodeId: id, data: { items: [], inputType: 'file' } })); // Reset items on error
      };
      reader.readAsText(file);
    }
  }, [dispatch, id]);

  // Derive current input type from data, default to text
  const currentInputType = data.inputType || 'text';

  return (
    <NodeErrorBoundary nodeId={id}>
      <div className={clsx("flex flex-col rounded-lg border bg-white shadow-lg", selected ? 'border-blue-500' : 'border-gray-300', 'w-[350px]')}> 
        <NodeHeader 
          nodeId={id} 
          label={data.label || 'Input'} 
          placeholderLabel="Input Node"
          isRootNode={true} // Input nodes are often roots
          isRunning={false} // Input nodes don't "run" in the same way
          viewMode="expanded" // Always expanded for input?
          themeColor="gray"
          onRun={() => {}} // No run action for basic input
          onLabelUpdate={handleLabelUpdate}
          onToggleView={() => {}} // No view toggle for basic input
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
              className="nodrag nowheel w-full h-32 p-2 border border-gray-300 rounded text-sm font-mono focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
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
            </div>
          )}
        </NodeBody>
        <NodeFooter>
          {/* Output Handle */} 
          <Handle 
            type="source" 
            position={Position.Right} 
            id="output"
            className="w-3 h-3 !bg-gray-500"
          />
          <p className="text-xs text-gray-500">Output (Text/List)</p>
        </NodeFooter>
      </div>
    </NodeErrorBoundary>
  );
};

export default InputNode; 