import React, { useEffect, useState, useMemo } from 'react';
import { ConfigFactory } from '../config/ConfigFactory';
import { useNodes } from '../../store/useFlowStructureStore';
import { Node } from '@xyflow/react'; // Import Node type
import { NodeData } from '../../types/nodes'; // Import NodeData type

// Enable debugging logs
const DEBUG_LOGS = false; // Disable logs for cleaner output, enable if needed

interface NodeConfigSidebarProps {
  selectedNodeId: string | null; // Prop name and type changed
}

export const NodeConfigSidebar: React.FC<NodeConfigSidebarProps> = ({ selectedNodeId }) => {
  const nodes = useNodes();
  const [isOpen, setIsOpen] = useState(false);

  // Find the selected node based on the single ID
  const selectedNode: Node<NodeData> | undefined = useMemo(() => {
    if (selectedNodeId) { // Check if ID is not null
      const foundNode = nodes.find(node => node.id === selectedNodeId);
      if (DEBUG_LOGS) {
        console.log(`[NodeConfigSidebar] Found node for ID ${selectedNodeId}:`, foundNode);
      }
      return foundNode;
    }
    return undefined; // Return undefined instead of null if not found or no ID
  }, [nodes, selectedNodeId]);

  // Update sidebar open state based on whether a node is selected
  useEffect(() => {
    setIsOpen(!!selectedNode); // Open if selectedNode exists
    if (DEBUG_LOGS) {
      console.log('[NodeConfigSidebar] Selection changed:', {
        selectedNodeId,
        hasNode: !!selectedNode,
        nodeType: selectedNode?.type
      });
    }
  }, [selectedNode, selectedNodeId]);

  // If no node is selected or the sidebar is not open, render nothing
  if (!selectedNode || !isOpen) return null; 

  // Removed multi-select message logic

  // Render sidebar content for the single selected node
  if (DEBUG_LOGS) {
    console.log('[NodeConfigSidebar] Rendering sidebar for node:', {
      id: selectedNode.id,
      type: selectedNode.type,
      label: selectedNode.data?.label
    });
  }

  return (
    <div className="w-80 bg-white shadow-lg h-full overflow-y-auto p-6 border-l border-gray-200 flex flex-col">
      <h2 className="text-xl font-semibold text-gray-800 mb-6 border-b pb-3">
        {/* Improve title display */}
        {selectedNode.data?.label || 
         (selectedNode.type ? selectedNode.type.charAt(0).toUpperCase() + selectedNode.type.slice(1) : 'Node') + ' Configuration'}
      </h2>
      {/* Pass the correctly typed selectedNode */}
      <ConfigFactory selectedNode={selectedNode as Node<NodeData>} /> 
    </div>
  );
}; 