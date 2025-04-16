import { useState } from 'react';
import { Handle, Position } from 'reactflow';
import { InputFileManager } from './input/InputFileManager';
import { InputItemList } from './input/InputItemList';
import { InputTextManagerNode } from './input/InputTextManagerNode';
import { InputModeToggle } from './input/InputModeToggle';
import { InputSummaryBar } from './input/InputSummaryBar';
import { NodeProps } from '../types/NodeProps';
import { Node } from '../core/Node';
import { useNodeContent } from '../store/nodeContents';
import { InputNodeContent } from '../store/nodeContents/common';
import { FileLikeObject } from '../types/nodes';
import { readTextFile, getImageFilePath } from '../utils/files';
import { FlowExecutionContext } from '../core/FlowExecutionContext';

// InputNode property type
interface InputNodeProperty {
  items: string[];
  iterateEachRow: boolean;
  nodeFactory?: any;
  [key: string]: any;
}

/**
 * InputNode allows adding text and files as input for the flow
 */
export class InputNode extends Node {
  declare property: InputNodeProperty;

  constructor(
    id: string, 
    property: InputNodeProperty = { items: [], iterateEachRow: false },
    context?: FlowExecutionContext
  ) {
    super(id, 'input', property, context);
  }

  /**
   * Execute the input node, handling batch vs foreach logic internally
   */
  async execute(input: any): Promise<any> {
    // Log execution if context is available
    if (this.context) {
      this.context.log(`InputNode (${this.id}) executing with ${this.property.items.length} items`);
    }
    
    const childNodes = this.getChildNodes();
    
    // Add the input to items array
    this.property.items.push(input);
    
    if (this.context) {
      this.context.log(`InputNode (${this.id}) now has ${this.property.items.length} items after adding input`);
    }

    if (this.property.iterateEachRow) { // foreach mode
      if (this.context) {
        this.context.log(`InputNode (${this.id}) using foreach mode with ${childNodes.length} child nodes`);
      }
      
      for (const child of childNodes) {
        await child.process(input); // Process each child with individual input
      }
      return null; // Always return null (execution stops in parent Node.process)
    } else { // batch mode
      if (this.context) {
        this.context.log(`InputNode (${this.id}) using batch mode with all items`);
      }
      
      return this.property.items; // Return all items for chaining to children
    }
  }
}

/**
 * InputNodeComponent renders the UI for the InputNode
 */
export function InputNodeComponent({ id, data, selected }: NodeProps) {
  const { content, setContent } = useNodeContent(id);
  const inputContent = content as InputNodeContent;
  const [textBuffer, setTextBuffer] = useState('');

  // Get items from content store with fallback to empty array
  const items = inputContent.items || [];
  const isForeachMode = inputContent.iterateEachRow || false;
  
  // Count item types
  const fileCount = items.filter((item) => {
    if (typeof item === 'string') {
      return /\.(jpg|jpeg|png|gif|webp|svg|bmp|txt|md|csv|json|js|ts|html|css|xml|yml|yaml)$/i.test(item);
    }
    return false;
  }).length;
  const textCount = items.length - fileCount;
  
  const itemCount = {
    total: items.length,
    fileCount,
    textCount
  };

  /**
   * Get file path information for image files
   */
  const saveFile = async (file: File): Promise<string> => {
    try {
      console.log(`Processing file: ${file.name}, type: ${file.type}, size: ${file.size} bytes`);
      
      // Use the getImageFilePath utility to create a virtual path for the image
      const { path } = getImageFilePath(file);
      
      console.log(`Created path for file: ${path}`);
      return path;
    } catch (error) {
      console.error('Error processing file:', error);
      throw new Error(`Failed to process file: ${file.name} - ${error}`);
    }
  };

  /**
   * Handle text input
   */
  const handleAddText = (text: string) => {
    if (!text.trim()) return;
    
    // Add text directly to items array
    setContent({
      items: [...items, text]
    });
    
    setTextBuffer('');
  };

  /**
   * Handle file upload
   */
  const handleFileUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const newItems = [...items];
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      
      // For image files, store the file path
      if (file.type.startsWith('image/')) {
        const filePath = await saveFile(file);
        newItems.push(filePath);
      } 
      // For text files, extract and store the content
      else if (
        file.type.startsWith('text/') || 
        /\.(txt|md|csv|json|js|ts|html|css|xml|yml|yaml)$/i.test(file.name)
      ) {
        try {
          const content = await readTextFile(file);
          newItems.push(content);
        } catch (error) {
          console.error('Error reading text file:', error);
        }
      }
    }
    
    // Update the content store with new items
    setContent({ 
      items: newItems 
    });
  };

  /**
   * Handle deleting an item
   */
  const handleDeleteItem = (itemIndex: number) => {
    setContent({
      items: items.filter((_, idx: number) => idx !== itemIndex)
    });
  };

  /**
   * Clear all items
   */
  const handleClearItems = () => {
    setContent({ 
      items: [] 
    });
  };

  /**
   * Toggle between batch and foreach modes
   */
  const handleToggleMode = () => {
    setContent({ 
      iterateEachRow: !isForeachMode 
    });
  };

  // Convert items to strings for display in UI
  const stringItems = items.map(item => {
    if (typeof item === 'string') {
      return item;
    } else if (typeof item === 'object' && item !== null) {
      // Check if it matches FileLikeObject structure
      if ('file' in item && 'type' in item) {
        return `File: ${(item as FileLikeObject).file}`;
      }
      return `Object: ${JSON.stringify(item).substring(0, 30)}...`;
    }
    return String(item);
  });

  return (
    <div className={`node ${selected ? 'node-selected' : ''} w-[320px]`}>
      <div className="node-header">Input</div>
      <div className="node-content p-3 space-y-4">
        {/* File uploader */}
        <InputFileManager 
          onFileUpload={handleFileUpload}
          nodeId={id}
        />
        
        {/* Text input */}
        <InputTextManagerNode 
          onAddText={handleAddText}
        />
        
        {/* Item list */}
        <div>
          <div className="text-xs font-medium text-gray-500 mb-1">Items</div>
          {items.length === 0 ? (
            <div className="text-xs text-gray-500 bg-gray-50 p-2 border border-dashed border-gray-200 rounded text-center">
              Add text or files to begin
            </div>
          ) : (
            <InputItemList 
              items={stringItems}
              onDelete={handleDeleteItem}
              onClear={handleClearItems}
              showClear={true}
              limit={5}
            />
          )}
        </div>
        
        {/* Mode toggle */}
        <InputModeToggle
          isForeachMode={isForeachMode}
          onToggle={handleToggleMode}
        />
      </div>
      
      {/* Summary bar */}
      <InputSummaryBar 
        itemCount={itemCount}
        processingMode={isForeachMode ? 'foreach' : 'batch'}
      />
      
      {/* Output handle */}
      <Handle type="source" position={Position.Bottom} id="output" />
    </div>
  );
} 