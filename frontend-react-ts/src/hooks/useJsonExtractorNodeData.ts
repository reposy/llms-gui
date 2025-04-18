import { useCallback } from 'react';
import { useNodeContentStore, NodeContent } from '../store/useNodeContentStore'; // Import main store and types
import { useFlowStructureStore } from '../store/useFlowStructureStore'; // Import structure store
import { isEqual } from 'lodash';
import { Node as ReactFlowNode } from '@xyflow/react'; // Import React Flow Node type
import { JSONExtractorNodeData } from '../types/nodes'; // Corrected type name casing

/**
 * Custom hook to manage JSON Extractor node state and operations.
 * - Configuration (path, label) is managed via useFlowStructureStore (node.data).
 * - Result/Output content is managed via useNodeContentStore.
 */
export const useJsonExtractorNodeData = ({
  nodeId
}: {
  nodeId: string
}) => {
  // --- Structure Store Access (for Configuration) ---
  const { setNodes, getNode } = useFlowStructureStore(state => ({
    setNodes: state.setNodes,
    getNode: (id: string) => state.nodes.find(n => n.id === id)
  }));

  const node = getNode(nodeId);
  const nodeData = node?.data as JSONExtractorNodeData | undefined; // Use corrected type name

  // --- Content Store Access (for Result/Output) ---
  const { getNodeContent, setNodeContent } = useNodeContentStore(state => ({
    getNodeContent: state.getNodeContent,
    setNodeContent: state.setNodeContent
  }));

  // Get the specific content part (e.g., the extracted result)
  // Assuming the result is stored in the 'content' field of the store entry
  const result = getNodeContent<NodeContent>(nodeId)?.content;
  const isContentDirty = useNodeContentStore(state => state.isNodeDirty(nodeId));


  // --- Derived Configuration State ---
  // Get config from node.data, provide defaults
  const path = nodeData?.path || '';
  const label = nodeData?.label || 'JSON Extractor Node';
  const defaultValue = nodeData?.defaultValue || ''; // Added defaultValue

  // --- Callback for Configuration Changes ---
  const handleConfigChange = useCallback((updates: Partial<JSONExtractorNodeData>) => {
    const targetNode = getNode(nodeId);
    if (!targetNode || targetNode.type !== 'json-extractor') {
      console.warn(`[useJsonExtractorNodeData] Node ${nodeId} not found or not a json-extractor node.`);
      return;
    }

    const currentData = targetNode.data as JSONExtractorNodeData;
    const hasChanges = Object.entries(updates).some(([key, value]) => {
        const dataKey = key as keyof JSONExtractorNodeData;
        return !isEqual(currentData[dataKey], value);
    });

    if (!hasChanges) {
      console.log(`[useJsonExtractorNodeData ${nodeId}] Skipping config update - no changes.`);
      return;
    }

    const updatedData: JSONExtractorNodeData = {
        ...currentData,
        ...updates,
        type: 'json-extractor', // Ensure type is set
        label: ('label' in updates ? updates.label : currentData.label) ?? 'JSON Extractor Node', // Ensure label exists
        path: ('path' in updates ? updates.path : currentData.path) ?? '', // Ensure path exists
        defaultValue: ('defaultValue' in updates ? updates.defaultValue : currentData.defaultValue) ?? '', // Ensure defaultValue exists
    };

    setNodes(
      useFlowStructureStore.getState().nodes.map((n: ReactFlowNode<any>) => { // Use more general type or NodeData if available
        if (n.id === nodeId) {
          return { ...n, data: updatedData };
        }
        return n;
      })
    );
  }, [nodeId, getNode, setNodes]);


  /**
   * Handle path configuration change
   */
  const handlePathChange = useCallback((newPath: string) => {
    handleConfigChange({ path: newPath });
  }, [handleConfigChange]);

  /**
   * Handle label configuration change
   */
   const handleLabelChange = useCallback((newLabel: string) => {
    handleConfigChange({ label: newLabel });
   }, [handleConfigChange]);

   /**
    * Handle defaultValue configuration change
    */
   const handleDefaultValueChange = useCallback((newDefaultValue: string) => {
    handleConfigChange({ defaultValue: newDefaultValue });
   }, [handleConfigChange]);

  /**
   * Note: updateJsonExtractorContent is removed as config changes are handled by handleConfigChange.
   * If there's a need to update the *result* content (stored in useNodeContentStore),
   * a separate function calling `setNodeContent` would be needed.
   */

  return {
    // Configuration Data (from node.data)
    path,
    label,
    defaultValue,

    // Result Data (from nodeContentStore)
    result, // Renamed 'content' to 'result' for clarity
    isDirty: isContentDirty, // Reflects content store dirtiness

    // Configuration Change Handlers
    handlePathChange,
    handleLabelChange,
    handleDefaultValueChange,
    handleConfigChange, // Expose the generic config handler if needed
  };
}; 