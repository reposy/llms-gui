import React, { useCallback } from 'react';
import ReactFlow, {
  useReactFlow,
  NodeChange,
  EdgeChange,
  Connection,
  addEdge,
  Node,
  Edge,
  applyNodeChanges,
  applyEdgeChanges,
} from 'reactflow';
import { NodeData } from '../types/nodes';

const Flow: React.FC = () => {
  const { nodes, edges, setNodes, setEdges } = useReactFlow<NodeData>();

  const onNodesChange = useCallback((changes: NodeChange[]) => {
    setNodes((nds: Node<NodeData>[]) => applyNodeChanges(changes, nds));
  }, [setNodes]);

  const onEdgesChange = useCallback((changes: EdgeChange[]) => {
    setEdges((eds: Edge[]) => applyEdgeChanges(changes, eds));
  }, [setEdges]);

  const onConnect = useCallback((connection: Connection) => {
    setEdges((eds: Edge[]) => addEdge(connection, eds));
  }, [setEdges]);

  const handleNodeDataChange = useCallback((nodeId: string, newData: Partial<NodeData>) => {
    setNodes((nds: Node<NodeData>[]) =>
      nds.map((node) => {
        if (node.id === nodeId) {
          return {
            ...node,
            data: {
              ...node.data,
              ...newData,
              onDataChange: (data: Partial<NodeData>) => handleNodeDataChange(nodeId, data),
            },
          };
        }
        return node;
      })
    );
  }, [setNodes]);

  const addNode = useCallback((type: string) => {
    const newNode: Node<NodeData> = {
      id: `${type}-${Date.now()}`,
      type,
      position: { x: 100, y: 100 },
      data: {
        type,
        provider: 'ollama',
        onDataChange: (data: Partial<NodeData>) => handleNodeDataChange(newNode.id, data),
      },
    };

    setNodes((nds: Node<NodeData>[]) => [...nds, newNode]);
  }, [handleNodeDataChange, setNodes]);

  return (
    <div className="w-full h-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        fitView
      >
        {/* Add your node types and other components here */}
      </ReactFlow>
    </div>
  );
};

export default Flow; 