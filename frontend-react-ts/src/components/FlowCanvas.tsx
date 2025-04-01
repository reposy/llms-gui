import React, { useCallback, useMemo } from 'react';
import ReactFlow, {
  MiniMap,
  Controls,
  Background,
  Connection,
  addEdge,
  Node,
  NodeChange,
  EdgeChange,
  Edge,
  useReactFlow,
  Panel,
  Viewport,
  applyEdgeChanges,
  applyNodeChanges,
} from 'reactflow';
import { useDispatch, useSelector } from 'react-redux';
import 'reactflow/dist/style.css';

import LLMNode from './nodes/LLMNode';
import APINode from './nodes/APINode';
import OutputNode from './nodes/OutputNode';
import JSONExtractorNode from './nodes/JSONExtractorNode';
import { NodeData, NodeType } from '../types/nodes';
import { RootState } from '../store/store';
import { setNodes, setEdges } from '../store/flowSlice';

// Custom wrapper to remove default React Flow node styling
const NodeWrapper = ({ children, ...props }: { children: React.ReactNode } & any) => (
  <div style={{ position: 'relative' }} className="react-flow__node">
    {children}
  </div>
);

// Override default node styles completely
const nodeTypes = {
  llm: (props: any) => (
    <NodeWrapper {...props}>
      <LLMNode {...props} />
    </NodeWrapper>
  ),
  api: (props: any) => (
    <NodeWrapper {...props}>
      <APINode {...props} />
    </NodeWrapper>
  ),
  output: (props: any) => (
    <NodeWrapper {...props}>
      <OutputNode {...props} />
    </NodeWrapper>
  ),
  'json-extractor': (props: any) => (
    <NodeWrapper {...props}>
      <JSONExtractorNode {...props} />
    </NodeWrapper>
  ),
};

interface FlowCanvasProps {
  onNodeSelect: (node: Node | null) => void;
}

const defaultViewport = { x: 0, y: 0, zoom: 1 };

export const FlowCanvas = React.memo(({ onNodeSelect }: FlowCanvasProps) => {
  const dispatch = useDispatch();
  const nodes = useSelector((state: RootState) => state.flow.nodes);
  const edges = useSelector((state: RootState) => state.flow.edges);
  const { project } = useReactFlow();

  const onNodesChange = useCallback((changes: NodeChange[]) => {
    const updatedNodes = applyNodeChanges(changes, nodes);
    dispatch(setNodes(updatedNodes));
  }, [dispatch, nodes]);

  const onEdgesChange = useCallback((changes: EdgeChange[]) => {
    const newEdges = applyEdgeChanges(changes, edges);
    dispatch(setEdges(newEdges));
  }, [dispatch, edges]);

  const onConnect = useCallback((params: Connection) => {
    // Validate connection based on node types
    const sourceNode = nodes.find(n => n.id === params.source);
    const targetNode = nodes.find(n => n.id === params.target);

    if (!sourceNode || !targetNode) return;

    // LLM node can only connect its output to Output node's input
    if (sourceNode.type === 'llm' && targetNode.type === 'output' && 
        params.sourceHandle?.endsWith('-source') && params.targetHandle?.endsWith('-target')) {
      const newEdges = addEdge(params, edges);
      dispatch(setEdges(newEdges));
    }
    // API node can only connect its output to Output node's input
    else if (sourceNode.type === 'api' && targetNode.type === 'output' &&
             params.sourceHandle?.endsWith('-source') && params.targetHandle?.endsWith('-target')) {
      const newEdges = addEdge(params, edges);
      dispatch(setEdges(newEdges));
    }
  }, [dispatch, edges, nodes]);

  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    onNodeSelect(node);
  }, [onNodeSelect]);

  const onPaneClick = useCallback(() => {
    onNodeSelect(null);
  }, [onNodeSelect]);

  const resetView = useCallback(() => {
    project({ x: 0, y: 0 } as Viewport);
  }, [project]);

  const miniMapNodeColor = useCallback((node: Node) => {
    switch (node.type as NodeType) {
      case 'llm':
        return '#3b82f6';
      case 'api':
        return '#22c55e';
      case 'output':
        return '#8b5cf6';
      default:
        return '#94a3b8';
    }
  }, []);

  return (
    <div className="w-full h-full" style={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0 }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={onNodeClick}
        onPaneClick={onPaneClick}
        nodeTypes={nodeTypes}
        defaultViewport={defaultViewport}
        fitView
        style={{ background: '#f8fafc', width: '100%', height: '100%' }}
        proOptions={{ hideAttribution: true }}
      >
        <Background gap={16} color="#94a3b8" />
        <Controls showInteractive={false} />
        <MiniMap
          nodeColor={miniMapNodeColor}
          maskColor="rgba(248, 250, 252, 0.8)"
        />
        <Panel position="top-right">
          <button
            onClick={resetView}
            className="bg-white p-2 rounded-lg shadow-md hover:shadow-lg transition-shadow"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        </Panel>
      </ReactFlow>
    </div>
  );
}); 