// src/components/nodes/GroupNode.tsx
import React, { useMemo, useCallback, memo, useRef, useEffect } from 'react';
import { Handle, Position, NodeProps, NodeResizer, useReactFlow, Node } from '@xyflow/react';
import clsx from 'clsx';
import { GroupNodeData, NodeData } from '../../types/nodes';
import { useNodeState } from '../../store/useNodeStateStore';
import { getRootNodesFromSubset } from '../../utils/flow/executionUtils';
import { useGroupNodeData } from '../../hooks/useGroupNodeData';
import { useNodes, useEdges, useFlowStructureStore } from '../../store/useFlowStructureStore';
import { FlowExecutionContext } from '../../core/FlowExecutionContext';
import { NodeFactory } from '../../core/NodeFactory';
import { registerAllNodeTypes } from '../../core/NodeRegistry';
import { v4 as uuidv4 } from 'uuid';
import { buildExecutionGraphFromFlow, getExecutionGraph } from '../../store/useExecutionGraphStore';

// Add CSS import back to handle z-index
import './GroupNode.css';

const GroupNode: React.FC<NodeProps> = ({ id, data, selected, isConnectable }) => {
  const groupData = data as GroupNodeData;
  
  const allNodes = useNodes();
  const allEdges = useEdges();
  const { nodes, edges } = useFlowStructureStore();
  const nodeState = useNodeState(id);
  const isRunning = nodeState?.status === 'running';
  const { setNodes } = useReactFlow();
  const executionContextRef = useRef<FlowExecutionContext | null>(null);
  
  const { 
    label, 
    isCollapsed, 
    toggleCollapse,
    handleLabelChange 
  } = useGroupNodeData({ nodeId: id });

  const { nodesInGroup, hasInternalRootNodes } = useMemo(() => {
    // Check both parentId and parentNode properties to support both formats
    const nodesWithParentId = allNodes.filter((node: Node<NodeData>) => 
      node.parentId === id
    );
    
    // React Flow v11+에서 사용되는 parentNode 속성도 체크 (호환성 보장)
    const nodesWithParentNode = allNodes.filter((node: any) => 
      node.parentNode === id && !node.parentId
    );
    
    // 두 결과 결합 (중복 제거)
    const combinedNodes = [...nodesWithParentId];
    nodesWithParentNode.forEach(node => {
      if (!combinedNodes.some(n => n.id === node.id)) {
        combinedNodes.push(node);
      }
    });
    
    // 개발 모드에서만 로깅 - 성능 최적화
    if (process.env.NODE_ENV === 'development') {
      // console.log(`[GroupNode] ID: ${id}, 전체 노드 수: ${allNodes.length}, 그룹에 속한 노드 수: ${combinedNodes.length}`);
    }
    
    const nodeIdsInGroup = new Set(combinedNodes.map(n => n.id));
    const edgesInGroup = allEdges.filter(edge => nodeIdsInGroup.has(edge.source) && nodeIdsInGroup.has(edge.target));
    const internalRoots = getRootNodesFromSubset(combinedNodes, edgesInGroup);
    
    return {
      nodesInGroup: combinedNodes,
      hasInternalRootNodes: internalRoots.length > 0,
    };
  }, [allNodes, allEdges, id]);

  // Clean up any running executions when the component unmounts
  useEffect(() => {
    return () => {
      if (executionContextRef.current) {
        // Clean up logic if needed
        executionContextRef.current = null;
      }
    };
  }, []);

  const runNodesInGroup = useCallback((
    executionContext: FlowExecutionContext, 
    nodesInGroupList: Node[],
    edgesList: any[],
    nodesList: any[]
  ) => {
    // 그룹 내 노드 ID 집합
    const nodeIdsInGroup = new Set(nodesInGroupList.map(n => n.id));
    
    // 그룹 내 작업을 처리할 실행 컨텍스트 생성
    executionContext.log(`그룹 ${id} 내부의 노드 실행 시작`);
    
    // 먼저 그룹 노드 자신을 running 상태로 표시
    executionContext.markNodeRunning(id);
    
    // 그룹 내 엣지만 필터링
    const edgesInGroup = edgesList.filter(edge => 
      nodeIdsInGroup.has(edge.source) && nodeIdsInGroup.has(edge.target)
    );
    
    // 그룹 내부의 루트 노드 찾기 (그룹 노드 자신은 제외)
    const internalRootNodes = nodesInGroupList.filter(node => 
      // 들어오는 엣지가 없는 노드를 찾음
      !edgesInGroup.some(edge => edge.target === node.id)
    );
    
    if (process.env.NODE_ENV === 'development') {
      // console.log(`[handleRunGroup] 그룹 ${id} 내부의 루트 노드:`, 
      //   internalRootNodes.map(n => ({ id: n.id, type: n.type }))
      // );
    }
    
    const executionGraph = getExecutionGraph();
    const nodeFactory = new NodeFactory();
    registerAllNodeTypes();
    
    // 각 루트 노드에 대해 처리
    const rootPromises = internalRootNodes.map(rootNode => {
      const nodeInstance = nodeFactory.create(
        rootNode.id,
        rootNode.type as string,
        rootNode.data,
        executionContext
      );
      
      nodeInstance.property = {
        ...nodeInstance.property,
        nodes: nodesList,
        edges: edgesList,
        nodeFactory,
        executionGraph
      };
      
      return nodeInstance.process({}).catch((error: Error) => {
        console.error(`그룹 ${id} 내 노드 ${rootNode.id} 실행 오류:`, error);
        executionContext.markNodeError(rootNode.id, error.message);
      });
    });
    
    // 모든 루트 노드 실행 완료 후 그룹 노드 성공 상태로 표시
    return Promise.all(rootPromises)
      .then(() => {
        executionContext.log(`그룹 ${id} 내부의 모든 노드 실행 완료`);
        executionContext.markNodeSuccess(id, { message: "그룹 내 노드 실행 완료" });
      })
      .catch(error => {
        executionContext.log(`그룹 ${id} 실행 중 오류 발생: ${error.message}`);
        executionContext.markNodeError(id, error.message);
      });
  }, [id]);

  const handleRunGroup = useCallback(() => {
    if (isRunning) return;
    
    const executionId = `exec-${uuidv4()}`;
    const executionContext = new FlowExecutionContext(executionId);
    executionContextRef.current = executionContext;
    
    // 그룹 노드 자신이 아닌 그룹 내부의 노드들을 실행하도록 설정
    executionContext.setTriggerNode(id);
    
    buildExecutionGraphFromFlow(nodes, edges);
    
    // 그룹 노드 자체는 항상 런닝 상태로 표시
    const groupNode = nodes.find(n => n.id === id);
    if (!groupNode) {
      executionContext.log(`그룹 ${id}를 찾을 수 없습니다.`);
      return;
    }
    
    // 그룹 내부의 실제 루트 노드들을 직접 찾아서 실행
    if (nodesInGroup.length > 0) {
      runNodesInGroup(executionContext, nodesInGroup, allEdges, nodes);
    } else {
      // 그룹 내 노드가 없는 경우
      executionContext.log(`그룹 ${id}에 실행할 노드가 없습니다.`);
      executionContext.markNodeSuccess(id, { message: "그룹 내 노드 없음" });
    }
  }, [id, isRunning, nodes, edges, nodesInGroup, allEdges, runNodesInGroup]);
  
  const handleSelectGroup = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      e.stopPropagation();
      
      setNodes(nodes => 
        nodes.map(node => ({
          ...node,
          selected: node.id === id
        }))
      );
    }
  }, [id, setNodes]);

  return (
    <>
      <NodeResizer
        minWidth={150}
        minHeight={100}
        isVisible={selected}
        lineClassName="border-blue-500"
        handleClassName="h-2 w-2 bg-white border border-blue-500"
      />
      
      <div
        className={clsx(
          'w-full h-full',
          'border-2',
          selected ? 'border-orange-600 group-node-selected' : 'border-orange-400',
          'rounded-md',
          'flex flex-col',
          'bg-orange-100/50',
          'group-node-container',
          'cursor-move'
        )}
        onClick={handleSelectGroup}
        data-testid={`group-node-${id}`}
      >
        <div
          className={clsx(
            'flex items-center justify-between p-1 text-xs text-orange-800 bg-orange-200/70 rounded-t-md',
            'group-node-header'
          )}
        >
          <span>{label}</span>
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleRunGroup();
            }}
            disabled={isRunning}
            className={clsx(
              'ml-2 px-1.5 py-0.5 text-xs font-medium rounded transition-colors',
              'bg-orange-100 text-orange-700 hover:bg-orange-200 disabled:opacity-50 disabled:cursor-not-allowed',
              'group-controls'
            )}
            title="Execute group nodes"
          >
            {isRunning ? '⏳' : '▶'} Run
          </button>
        </div>

        <div
          className={clsx(
            'flex-grow',
            'bg-orange-50/30',
            'rounded-b-md',
            'relative',
            'group-node-content',
            isCollapsed && 'collapsed'
          )}
          onClick={handleSelectGroup}
        >
          <div className="group-node-overlay"></div>
          
          {nodesInGroup.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center text-orange-300 text-xs placeholder">
              Drag nodes here
            </div>
          )}
          
          <div className="absolute top-2 right-2 p-2 bg-orange-50/70 rounded-md text-xs max-w-[80%] max-h-[75%] overflow-auto group-controls">
            <div className="font-medium mb-1">Nodes in Group ({nodesInGroup.length})</div>
            {nodesInGroup.length > 0 ? (
              <ul className="list-disc pl-4 text-xs text-gray-600">
                {nodesInGroup.map(node => (
                  <li key={node.id} className="truncate">
                    {node.data?.label || node.type || node.id}
                  </li>
                ))}
              </ul>
            ) : (
              <div className="text-orange-300 italic">No nodes defined in this group.</div>
            )}
          </div>
        </div>
      </div>

      <Handle
        type="target"
        position={Position.Left}
        id="target"
        className="!w-2.5 !h-2.5 !bg-orange-500 !border-2 !border-white !rounded-full !-ml-[5px]"
        isConnectable={isConnectable}
      />
      <Handle
        type="source"
        position={Position.Right}
        id="source"
        className="!w-2.5 !h-2.5 !bg-orange-500 !border-2 !border-white !rounded-full !-mr-[5px]"
        isConnectable={isConnectable}
      />
    </>
  );
};

export default memo(GroupNode);