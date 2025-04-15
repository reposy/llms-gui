import React, { useCallback, useState } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import NodeErrorBoundary from './NodeErrorBoundary';
import { NodeHeader } from './shared/NodeHeader';
import { NodeBody } from './shared/NodeBody';
import { NodeFooter } from './shared/NodeFooter';
import clsx from 'clsx';
import { v4 as uuidv4 } from 'uuid';

// 인라인 타입 정의
interface WebCrawlerNodeData {
  label?: string;
  url?: string;
  waitForSelector?: string;
  extractSelectors?: Record<string, string>;
  outputFormat?: string;
}

// 간소화된 상태 인터페이스
interface NodeState {
  status?: 'idle' | 'running' | 'success' | 'error';
  error?: string;
}

// 뷰 모드 상수 대체
const VIEW_MODES = {
  COMPACT: 'compact',
  EXPANDED: 'expanded'
};

const WebCrawlerNode: React.FC<NodeProps<WebCrawlerNodeData>> = ({ id, data, selected, isConnectable = true }) => {
  // 상태 단순화
  const nodeState: NodeState = { status: 'idle' };
  const isRunning = nodeState.status === 'running';
  const hasError = nodeState.status === 'error';
  
  // 뷰 모드 상태
  const [viewMode, setViewMode] = useState<typeof VIEW_MODES.COMPACT | typeof VIEW_MODES.EXPANDED>(VIEW_MODES.EXPANDED);
  
  // 데이터 단순화
  const nodes: any[] = [];
  const edges: any[] = [];
  
  // 실행 핸들러 단순화
  const handleRun = useCallback(() => {
    console.log(`[WebCrawlerNode] Starting execution for node ${id}`);
    
    try {
      console.log(`[WebCrawlerNode] Executing node ${id}`);
    } catch (error: unknown) {
      console.error(`[WebCrawlerNode] Error executing node ${id}:`, error);
    }
  }, [id]);
  
  // 라벨 업데이트 핸들러
  const handleLabelUpdate = useCallback((nodeId: string, newLabel: string) => {
    console.log(`Update label for node ${nodeId} to ${newLabel}`);
  }, []);
  
  // 뷰 토글 핸들러
  const handleToggleView = useCallback(() => {
    setViewMode(current => 
      current === VIEW_MODES.COMPACT ? VIEW_MODES.EXPANDED : VIEW_MODES.COMPACT
    );
  }, []);
  
  // URL 표시 형식
  const displayUrl = data.url 
    ? (data.url.length > 30 ? data.url.substring(0, 27) + '...' : data.url)
    : 'No URL set';
  
  // 추출기 개수
  const extractorCount = data.extractSelectors ? Object.keys(data.extractSelectors).length : 0;
  
  return (
    <NodeErrorBoundary nodeId={id}>
      <div 
        className={clsx(
          "node-container rounded-lg border-2 shadow-sm w-72",
          selected ? "border-blue-500" : "border-blue-300",
          hasError ? "border-red-500" : ""
        )}
      >
        <NodeHeader 
          nodeId={id}
          label={data.label || "Web Crawler"}
          placeholderLabel="Web Crawler"
          isRootNode={true}
          isRunning={isRunning}
          viewMode={viewMode}
          themeColor="blue"
          onRun={handleRun}
          onLabelUpdate={handleLabelUpdate}
          onToggleView={handleToggleView}
        />
        
        <NodeBody>
          <div className="p-3 space-y-3">
            <div className="text-xs">
              <span className="font-semibold">URL:</span> 
              <span className="ml-1 font-mono text-blue-600 break-all">{displayUrl}</span>
            </div>
            
            {data.waitForSelector && (
              <div className="text-xs">
                <span className="font-semibold">Wait for:</span> 
                <span className="ml-1 font-mono">{data.waitForSelector}</span>
              </div>
            )}
            
            {extractorCount > 0 && (
              <div className="text-xs">
                <span className="font-semibold">Extractors:</span> 
                <span className="ml-1">{extractorCount} defined</span>
              </div>
            )}
            
            <div className="text-xs">
              <span className="font-semibold">Output:</span> 
              <span className="ml-1 capitalize">{data.outputFormat || 'full'}</span>
            </div>
            
            {/* Error message display */}
            {hasError && nodeState.error && (
              <div className="text-xs text-red-500 mt-2">
                {nodeState.error}
              </div>
            )}
          </div>
        </NodeBody>
        
        <NodeFooter>
          {/* Actions or status indicators */}
          {isRunning && (
            <div className="text-xs text-blue-500">Processing...</div>
          )}
        </NodeFooter>
        
        {/* Input handle */}
        <Handle
          type="target"
          position={Position.Left}
          id="target"
          isConnectable={isConnectable}
          style={{
            background: "#22c55e",
            border: "1px solid white",
            width: "8px",
            height: "8px",
            top: "50%",
            transform: "translateY(-50%)",
            left: "-4px",
            zIndex: 50,
          }}
        />
        
        {/* Output handle */}
        <Handle
          type="source"
          position={Position.Right}
          id="source"
          isConnectable={isConnectable}
          style={{
            background: "#22c55e",
            border: "1px solid white",
            width: "8px",
            height: "8px",
            top: "50%",
            transform: "translateY(-50%)",
            right: "-4px",
            zIndex: 50,
          }}
        />
      </div>
    </NodeErrorBoundary>
  );
};

export default WebCrawlerNode; 