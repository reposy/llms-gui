import React, { useCallback, useState, useEffect, ChangeEvent } from 'react';
import { useDispatch } from 'react-redux';
import { InputNodeData } from '../../types/nodes';
import { updateNodeData } from '../../store/flowSlice';

interface InputNodeConfigProps {
  nodeId: string;
  data: InputNodeData;
}

// Reusable label component
const ConfigLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <label className="block text-sm font-medium text-gray-700 mb-1">
    {children}
  </label>
);

export const InputNodeConfig: React.FC<InputNodeConfigProps> = ({ nodeId, data }) => {
  const dispatch = useDispatch();
  const [currentText, setCurrentText] = useState(data.text || '');
  const [fileName, setFileName] = useState<string | null>(null);

  console.log('[InputNodeConfig] Rendering with data:', data);

  // Update local state if the node data changes externally
  useEffect(() => {
    setCurrentText(data.text || '');
  }, [data.text]);

  // Handle config changes
  const handleConfigChange = useCallback((updates: Partial<InputNodeData>) => {
    dispatch(updateNodeData({
      nodeId,
      data: { ...data, ...updates }
    }));
  }, [dispatch, nodeId, data]);

  // Handle input type change
  const handleTypeChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const newType = event.target.value as 'text' | 'file' | 'list';
    console.log(`[InputNodeConfig] Type changed to: ${newType}`);
    
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

  // Handle text input change
  const handleTextChange = useCallback((event: ChangeEvent<HTMLTextAreaElement>) => {
    const newText = event.target.value;
    setCurrentText(newText);
    handleConfigChange({ 
      text: newText, 
      inputType: 'text',
      items: [] // Clear items if text is manually edited
    });
  }, [handleConfigChange]);

  // Handle file input change
  const handleFileChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setFileName(file.name);
      console.log(`[InputNodeConfig] File selected: ${file.name}`);
      const reader = new FileReader();
      reader.onload = (e) => {
        const fileContent = e.target?.result as string;
        // Split by lines, trim whitespace, and filter out empty lines
        const lines = fileContent.split(/\r?\n/).map(line => line.trim()).filter(line => line !== '');
        console.log(`[InputNodeConfig] File processed, ${lines.length} lines`);
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
        handleConfigChange({ 
          items: [], 
          inputType: 'file' 
        }); // Reset items on error
      };
      reader.readAsText(file);
    }
  }, [handleConfigChange]);

  // Handle "iterate each row" checkbox change
  const handleIterateEachRowChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const checked = event.target.checked;
    console.log(`[InputNodeConfig] iterateEachRow changed to: ${checked}`);
    handleConfigChange({ iterateEachRow: checked });
  }, [handleConfigChange]);

  // Prevent keydown events from bubbling to parent components
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    e.stopPropagation();
  }, []);

  // Derive current input type from data, default to text
  const currentInputType = data.inputType || 'text';
  
  // Always show iterateEachRow checkbox for file/list inputs
  const showIterateOption = currentInputType === 'file' || currentInputType === 'list' ||
                           (currentInputType === 'text' && data.text && data.text.includes('\n'));

  return (
    <div className="space-y-4">
      {/* Input Type Selection */}
      <div>
        <ConfigLabel>Input Type</ConfigLabel>
        <div className="flex space-x-4 mb-3">
          <label className="inline-flex items-center">
            <input 
              type="radio" 
              name={`inputType-${nodeId}`}
              value="text"
              checked={currentInputType === 'text'}
              onChange={handleTypeChange}
              className="form-radio h-4 w-4 text-blue-600"
            /> 
            <span className="ml-2 text-sm text-gray-700">Text Input</span>
          </label>
          <label className="inline-flex items-center">
            <input 
              type="radio" 
              name={`inputType-${nodeId}`}
              value="file"
              checked={currentInputType === 'file' || currentInputType === 'list'} // Show file selected if file or list
              onChange={handleTypeChange}
              className="form-radio h-4 w-4 text-blue-600"
            /> 
            <span className="ml-2 text-sm text-gray-700">File Input</span>
          </label>
        </div>
      </div>

      {/* Input Content Area */}
      {currentInputType === 'text' && (
        <div>
          <ConfigLabel>Text Content</ConfigLabel>
          <textarea
            value={currentText} 
            onChange={handleTextChange}
            onKeyDown={handleKeyDown}
            className="w-full h-48 p-2 border border-gray-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none bg-white text-black"
            placeholder="Enter text here..."
          />
        </div>
      )}

      {(currentInputType === 'file' || currentInputType === 'list') && (
        <div>
          <ConfigLabel>File Upload</ConfigLabel>
          <input 
            type="file"
            onChange={handleFileChange}
            onKeyDown={handleKeyDown}
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

      {/* Iterate Each Row Option - Always show for text with newlines or file inputs */}
      {showIterateOption && (
        <div className="border-t pt-3 mt-4">
          <label className="inline-flex items-center">
            <input
              type="checkbox"
              checked={!!data.iterateEachRow}
              onChange={handleIterateEachRowChange}
              className="form-checkbox h-4 w-4 text-blue-600 rounded"
            />
            <span className="ml-2 text-sm text-gray-700">Process each row separately (Foreach mode)</span>
          </label>
          <p className="mt-1 text-xs text-gray-500">
            When enabled, each line of input will be processed individually by downstream nodes.
          </p>
        </div>
      )}
    </div>
  );
}; 