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
  useNodes,
  useEdges,
  useNodesState,
  useEdgesState,
} from 'reactflow';
import { NodeData } from '../types/nodes';
import { createNewNode } from '../utils/flowUtils';

const Flow: React.FC = () => {
  const reactFlowInstance = useReactFlow<NodeData>();
  const [nodes, setNodes] = useNodesState<NodeData>([]);
  const [edges, setEdges] = useEdgesState([]);

  const onNodesChange = useCallback((changes: NodeChange[]) => {
    setNodes((nds) => applyNodeChanges(changes, nds));
  }, [setNodes]);

  const onEdgesChange = useCallback((changes: EdgeChange[]) => {
    setEdges((eds) => applyEdgeChanges(changes, eds));
  }, [setEdges]);

  const onConnect = useCallback((connection: Connection) => {
    setEdges((eds) => addEdge(connection, eds));
  }, [setEdges]);

  const handleNodeDataChange = useCallback((nodeId: string, newData: Partial<NodeData>) => {
    setNodes((nds) =>
      nds.map((node) => {
        if (node.id === nodeId) {
          return {
            ...node,
            data: {
              ...node.data,
              ...newData,
            } as NodeData,
          } as Node<NodeData>;
        }
        return node;
      })
    );
  }, [setNodes]);

  const addNode = useCallback((type: string) => {
    const position = { x: 100, y: 100 };
    const newNode = createNewNode(type as any, position);
    
    setNodes((nds) => [...nds, newNode as Node<NodeData>]);
  }, [setNodes]);

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