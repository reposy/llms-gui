import React from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { useNodeContent, useNodeContentStore } from '../../store/useNodeContentStore';
import { HTMLParserNodeContent, ExtractionRule } from '../../types/nodes';
import NodeErrorBoundary from './NodeErrorBoundary';
import { getNodeState } from '../../store/useNodeStateStore';
import clsx from 'clsx';
import { EditableNodeLabel } from './shared/EditableNodeLabel';
import { useFlowStructureStore, setNodes } from '../../store/useFlowStructureStore';

/**
 * HTML Parser 노드의 UI 컴포넌트
 */
const HTMLParserNode: React.FC<NodeProps> = ({ id, selected, data }) => {
  const { content } = useNodeContent<HTMLParserNodeContent>(id);
  const extractionRules = content?.extractionRules;
  const label = content?.label;
  
  const setNodeContent = useNodeContentStore(state => state.setNodeContent);
  const currentNodes = useFlowStructureStore(state => state.nodes);
  const nodeState = getNodeState(id);
  
  // 결과 데이터 가져오기
  const output = nodeState?.result;
  const nodeStatus = nodeState?.status;
  const isRunning = nodeStatus === 'running';
  const hasError = nodeStatus === 'error';
  const errorMessage = nodeState?.error;

  const handleLabelUpdate = (updatedNodeId: string, newLabel: string) => {
    setNodeContent(updatedNodeId, { label: newLabel });

    const updatedNodes = currentNodes.map(node => 
      node.id === updatedNodeId
        ? { 
            ...node, 
            data: { 
              ...node.data,
              label: newLabel
            } 
          } 
        : node
    );
    setNodes(updatedNodes);
    console.log(`[HTMLParserNode] Updated label for node ${updatedNodeId} in both stores.`);
  };

  const displayContent = () => {
    // 규칙 목록 표시
    if (!extractionRules || extractionRules.length === 0) {
      return <div className="text-gray-500 italic">규칙이 정의되지 않았습니다.</div>;
    }

    return (
      <div className="mb-2">
        <div className="text-sm font-medium mb-1">추출 규칙:</div>
        <div className="text-xs overflow-y-auto max-h-32 bg-gray-50 p-2 rounded">
          {extractionRules.map((rule: ExtractionRule, index: number) => (
            <div key={index} className="mb-1 pb-1 border-b border-gray-200 last:border-0">
              <div className="flex justify-between">
                <span className="font-medium">{rule.name}:</span>
                <span className="text-xs text-gray-500">{rule.multiple ? '다중 선택' : '단일 선택'}</span>
              </div>
              <div className="text-xs text-gray-700">{rule.selector}</div>
              <div className="text-xs text-gray-500">
                {rule.target === 'attribute' ? `속성: ${rule.attribute_name || ''}` : `대상: ${rule.target}`}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <NodeErrorBoundary nodeId={id}>
      <div className="relative w-[350px]">
        {/* 입력 핸들 */}
        <Handle
          type="target"
          position={Position.Left}
          id="input"
          style={{
            background: '#3b82f6',
            border: '1px solid white',
            width: '8px',
            height: '8px',
            top: '50%',
            transform: 'translateY(-50%)',
            left: '-4px',
            zIndex: 50
          }}
        />
        
        <div 
          className={clsx(
            'px-4 py-2 shadow-md rounded-md bg-white border',
            selected 
              ? 'border-blue-500 ring-2 ring-blue-300 ring-offset-1 shadow-lg' 
              : 'border-blue-200 shadow-sm',
            isRunning ? 'border-l-4 border-l-yellow-400' : '',
            hasError ? 'border-l-4 border-l-red-500' : ''
          )}
        >
          {/* 노드 헤더 */}
          <div className="flex justify-between items-center mb-2">
            <EditableNodeLabel
              nodeId={id}
              initialLabel={label || "HTML Parser"}
              placeholderLabel="HTML Parser"
              onLabelUpdate={handleLabelUpdate}
              labelClassName="font-semibold text-sm" 
              inputClassName="px-1 py-0.5 text-sm font-semibold border rounded focus:outline-none focus:ring-1 bg-white text-black"
            />
            {isRunning && <div className="text-xs px-2 py-0.5 bg-yellow-100 text-yellow-800 rounded">실행 중</div>}
            {hasError && <div className="text-xs px-2 py-0.5 bg-red-100 text-red-800 rounded">오류</div>}
          </div>
          
          {/* 노드 내용 */}
          <div>
            {displayContent()}
          </div>
          
          {/* 결과 표시 */}
          <div className="mt-4 border-t pt-2 border-gray-200">
            <div className="text-xs font-medium text-gray-700 mb-1">실행 결과:</div>
            {output ? (
              <div className="bg-gray-50 p-2 rounded text-xs max-h-36 overflow-y-auto">
                <pre className="whitespace-pre-wrap break-words">
                  {typeof output === 'object' ? JSON.stringify(output, null, 2) : String(output)}
                </pre>
              </div>
            ) : (
              <div className="text-xs text-gray-500 italic">실행 결과가 없습니다.</div>
            )}
            
            {hasError && (
              <div className="mt-2 bg-red-50 p-2 rounded border border-red-200">
                <div className="text-xs font-medium text-red-700 mb-1">오류:</div>
                <div className="text-xs text-red-600">{errorMessage}</div>
              </div>
            )}
          </div>
        </div>
        
        {/* 출력 핸들 */}
        <Handle
          type="source"
          position={Position.Right}
          id="output"
          style={{
            background: '#3b82f6',
            border: '1px solid white',
            width: '8px',
            height: '8px',
            right: '-4px',
            zIndex: 50
          }}
        />
      </div>
    </NodeErrorBoundary>
  );
};

export default HTMLParserNode; 