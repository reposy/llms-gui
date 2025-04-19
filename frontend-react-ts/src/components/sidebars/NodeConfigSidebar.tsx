import React, { useEffect, useState, useMemo } from 'react';
import { ConfigFactory } from '../config/ConfigFactory';
import { useNodes } from '../../store/useFlowStructureStore';
import { Node } from '@xyflow/react'; // Import Node type
import { NodeData } from '../../types/nodes'; // Import NodeData type

// Enable debugging logs
const DEBUG_LOGS = false; // Disable logs for cleaner output, enable if needed

interface NodeConfigSidebarProps {
  selectedNodeIds: string[] | null; // Changed to array of node IDs
}

export const NodeConfigSidebar: React.FC<NodeConfigSidebarProps> = ({ selectedNodeIds }) => {
  const nodes = useNodes();
  const [isOpen, setIsOpen] = useState(false);

  // Find all selected nodes
  const selectedNodes: Node<NodeData>[] = useMemo(() => {
    if (!selectedNodeIds || selectedNodeIds.length === 0) return [];
    return nodes.filter(node => selectedNodeIds.includes(node.id));
  }, [nodes, selectedNodeIds]);

  // Get the first selected node for configuration when only one is selected
  const primarySelectedNode: Node<NodeData> | undefined = useMemo(() => {
    return selectedNodes.length === 1 ? selectedNodes[0] : undefined;
  }, [selectedNodes]);

  // Update sidebar open state based on whether any nodes are selected
  useEffect(() => {
    setIsOpen(selectedNodes.length > 0);
    if (DEBUG_LOGS) {
      console.log('[NodeConfigSidebar] Selection changed:', {
        selectedNodeIds,
        selectedCount: selectedNodes.length,
        nodeTypes: selectedNodes.map(n => n.type)
      });
    }
  }, [selectedNodes, selectedNodeIds]);

  // If no nodes are selected or the sidebar is not open, render nothing
  if (selectedNodes.length === 0 || !isOpen) return null;

  // If multiple nodes are selected, show a summary view
  if (selectedNodes.length > 1) {
    return (
      <div className="w-80 bg-white shadow-lg h-full overflow-y-auto p-6 border-l border-gray-200 flex flex-col">
        <h2 className="text-xl font-semibold text-gray-800 mb-6 border-b pb-3">
          Multiple Nodes Selected ({selectedNodes.length})
        </h2>
        <div className="text-sm text-gray-600 mb-4">
          Select a single node to edit its configuration, or perform bulk actions on all selected nodes.
        </div>
        <div className="space-y-1 mt-4">
          <h3 className="font-medium text-gray-700 mb-2">Selected Nodes:</h3>
          {selectedNodes.map((node, index) => (
            <div key={node.id} className="flex items-center p-2 bg-gray-50 rounded-md">
              <span className="w-6 h-6 flex items-center justify-center rounded-full bg-gray-200 text-xs mr-2">
                {index + 1}
              </span>
              <div className="flex-1">
                <div className="font-medium">{node.data?.label || "Unnamed Node"}</div>
                <div className="text-xs text-gray-500">Type: {node.type}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Render config for the single selected node
  if (DEBUG_LOGS) {
    console.log('[NodeConfigSidebar] Rendering sidebar for node:', {
      id: primarySelectedNode?.id,
      type: primarySelectedNode?.type,
      label: primarySelectedNode?.data?.label
    });
  }

  return (
    <div className="w-80 bg-white shadow-lg h-full overflow-y-auto p-6 border-l border-gray-200 flex flex-col">
      <h2 className="text-xl font-semibold text-gray-800 mb-6 border-b pb-3">
        {/* Improve title display */}
        {primarySelectedNode?.data?.label || 
         (primarySelectedNode?.type ? primarySelectedNode.type.charAt(0).toUpperCase() + primarySelectedNode.type.slice(1) : 'Node') + ' Configuration'}
      </h2>
      {/* Pass the correctly typed selectedNode */}
      <ConfigFactory selectedNode={primarySelectedNode as Node<NodeData>} /> 
    </div>
  );
}; 