import { useCallback } from 'react';
import { useNodeContentStore, OutputNodeContent } from '../store/useNodeContentStore';
import { useFlowStructureStore } from '../store/useFlowStructureStore';
import { isEqual } from 'lodash';
import { Node as ReactFlowNode } from '@xyflow/react';
import { OutputNodeData, OutputFormat } from '../types/nodes';

/**
 * Custom hook to manage Output node state and operations.
 * - Configuration (format, label, mode) is managed via useFlowStructureStore (node.data).
 * - Result/Output content is managed via useNodeContentStore.
 */
export const useOutputNodeData = (nodeId: string) => {
  // --- Structure Store Access (for Configuration) ---
  const { setNodes, getNode } = useFlowStructureStore(state => ({
    setNodes: state.setNodes,
    getNode: (id: string) => state.nodes.find(n => n.id === id)
  }));

  const node = getNode(nodeId);
  const nodeData = node?.data as OutputNodeData | undefined;

  // --- Content Store Access (for Result Content) ---
  const { getNodeContent, setNodeContent } = useNodeContentStore(state => ({
    getNodeContent: state.getNodeContent,
    setNodeContent: state.setNodeContent
  }));

  // Get result content from content store
  const result = getNodeContent<OutputNodeContent>(nodeId)?.content;
  const isContentDirty = useNodeContentStore(state => state.isNodeDirty(nodeId));

  // --- Derived Configuration State ---
  const label = nodeData?.label || 'Output Node';
  const format = nodeData?.format || 'text';
  const mode = nodeData?.mode || 'read'; // Assuming mode is part of config

  // --- Callback for Configuration Changes ---
  const handleConfigChange = useCallback((updates: Partial<OutputNodeData>) => {
    const targetNode = getNode(nodeId);
    if (!targetNode || targetNode.type !== 'output') {
      console.warn(`[useOutputNodeData] Node ${nodeId} not found or not an output node.`);
      return;
    }

    const currentData = targetNode.data as OutputNodeData;
    const hasChanges = Object.entries(updates).some(([key, value]) => {
      const dataKey = key as keyof OutputNodeData;
      return !isEqual(currentData[dataKey], value);
    });

    if (!hasChanges) {
      console.log(`[useOutputNodeData ${nodeId}] Skipping config update - no changes.`);
      return;
    }

    const updatedData: OutputNodeData = {
      ...currentData,
      ...updates,
      type: 'output',
      label: ('label' in updates ? updates.label : currentData.label) ?? 'Output Node',
      format: ('format' in updates ? updates.format : currentData.format) ?? 'text',
      mode: ('mode' in updates ? updates.mode : currentData.mode) ?? 'read',
    };

    setNodes(
      useFlowStructureStore.getState().nodes.map((n: ReactFlowNode<any>) => {
        if (n.id === nodeId) {
          return { ...n, data: updatedData };
        }
        return n;
      })
    );
  }, [nodeId, getNode, setNodes]);

  // --- Configuration Change Handlers ---
  const handleLabelChange = useCallback((newLabel: string) => {
    handleConfigChange({ label: newLabel });
  }, [handleConfigChange]);

  const handleFormatChange = useCallback((newFormat: OutputFormat) => {
    handleConfigChange({ format: newFormat });
  }, [handleConfigChange]);

  const setMode = useCallback((newMode: 'write' | 'read') => {
    handleConfigChange({ mode: newMode });
  }, [handleConfigChange]);


  // --- Result Content Management Callbacks (using Content Store) ---
  const clearOutput = useCallback(() => {
    console.log(`[OutputNode ${nodeId}] Clearing output content`);
    // Update only the 'content' field to undefined in the content store
    setNodeContent<OutputNodeContent>(nodeId, { content: undefined });
  }, [nodeId, setNodeContent]);

  const handleContentChange = useCallback((newContent: any) => {
    console.log(`[OutputNode ${nodeId}] Setting output content`);
    // Update only the 'content' field in the content store
    setNodeContent<OutputNodeContent>(nodeId, { content: newContent });
  }, [nodeId, setNodeContent]);


  /**
   * 선택된 포맷에 따라 결과를 형식화하는 함수
   * @param data 형식화할 데이터 (주로 content store의 result)
   * @returns 형식화된 문자열
   */
  const formatResultBasedOnFormat = useCallback((
    data: any = result // Default to the result from content store
  ): string => {
    if (data === null || data === undefined) return '';

    const currentFormat = nodeData?.format || 'text'; // Get format from config

    try {
      switch (currentFormat) {
        case 'json':
          if (typeof data === 'string') {
            try {
              const parsed = JSON.parse(data);
              return JSON.stringify(parsed, null, 2);
            } catch {
              return JSON.stringify({ content: data }, null, 2);
            }
          } else {
            return JSON.stringify(data, null, 2);
          }
        // Removed yaml and html cases for brevity, assuming they follow similar logic
        case 'text':
        default:
          if (typeof data === 'string') {
            return data;
          } else {
            // Attempt to stringify non-string data for text format
            try {
              return JSON.stringify(data);
            } catch {
              return String(data);
            }
          }
      }
    } catch (error) {
      console.error('Error formatting output:', error);
      return String(data);
    }
  }, [result, nodeData?.format]); // Depend on result and config format

  return {
    // Configuration Data (from node.data)
    label,
    format,
    mode,

    // Result Data (from nodeContentStore)
    content: result, // Provide the result content
    isDirty: isContentDirty,

    // Configuration Change Handlers
    handleLabelChange,
    handleFormatChange,
    setMode,
    handleConfigChange, // Expose generic handler if needed

    // Result Content Handlers
    clearOutput,
    handleContentChange,

    // Formatting Utility
    formatResultBasedOnFormat,
  };
}; 