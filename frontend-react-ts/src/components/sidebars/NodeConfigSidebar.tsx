import React, { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { RootState } from '../../store/store';
import { ConfigFactory } from '../config/ConfigFactory';

interface NodeConfigSidebarProps {
  selectedNodeId: string | null;
}

export const NodeConfigSidebar: React.FC<NodeConfigSidebarProps> = ({ selectedNodeId }) => {
  const nodes = useSelector((state: RootState) => state.flow.nodes);
  const [isOpen, setIsOpen] = useState(false);
  
  // Get the selected node from Redux state
  const selectedNode = nodes.find(node => node.id === selectedNodeId);
  
  // Update sidebar open state based on selected node
  useEffect(() => {
    setIsOpen(!!selectedNode);
    // Add logging for debugging
    console.log('[NodeConfigSidebar] Selected node:', selectedNode);
    if (selectedNode) {
      console.log('[NodeConfigSidebar] Node type:', selectedNode.type);
      console.log('[NodeConfigSidebar] Node data:', selectedNode.data);
    }
  }, [selectedNode]);

  if (!isOpen) {
    return null;
  }

  console.log('[NodeConfigSidebar] Rendering sidebar for node type:', selectedNode?.type);

  return (
    <div className="w-80 bg-white shadow-lg h-full overflow-y-auto p-4 border-l">
      {selectedNode && (
        <>
          <h2 className="text-xl font-semibold text-gray-800 mb-4">
            {selectedNode.data.label || (selectedNode.type ? selectedNode.type.charAt(0).toUpperCase() + selectedNode.type.slice(1) : 'Node')}
          </h2>
          
          <ConfigFactory selectedNode={selectedNode} />
        </>
      )}
    </div>
  );
}; 