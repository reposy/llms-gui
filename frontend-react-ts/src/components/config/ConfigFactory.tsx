import React from 'react';
import { Node } from '@xyflow/react';
import { 
  NodeData, 
  LLMNodeData, 
  APINodeData, 
  OutputNodeData, 
  InputNodeData,
  ConditionalNodeData,
  GroupNodeData,
  MergerNodeData,
  WebCrawlerNodeData
} from '../../types/nodes';

// Import components directly with relative path
import { LLMConfig } from './LLMConfig';
import { APIConfig } from './APIConfig';
import { OutputConfig } from './OutputConfig';
import { InputNodeConfig } from './InputNodeConfig';
import { ConditionalNodeConfig } from './ConditionalNodeConfig';
import { GroupNodeConfig } from './GroupNodeConfig';
import MergerConfig from './MergerConfig';
import { WebCrawlerNodeConfig } from './WebCrawlerNodeConfig';
import { HTMLParserNodeConfig } from './HTMLParserNodeConfig';

// 디버깅 모드 설정
const DEBUG_LOGS = false;

interface ConfigFactoryProps {
  selectedNode: Node<NodeData> | null;
}

export const ConfigFactory: React.FC<ConfigFactoryProps> = React.memo(({ selectedNode }) => {
  if (!selectedNode) {
    if (DEBUG_LOGS) console.log('[ConfigFactory] No node selected');
    return (
      <div className="flex items-center justify-center h-full text-gray-500">
        No node selected
      </div>
    );
  }

  const { id, data, type } = selectedNode;
  if (DEBUG_LOGS) console.log(`[ConfigFactory] Rendering config for node: ${id}, type: ${type}`);

  // Return the appropriate config component based on node type
  switch (type) {
    case 'llm':
      if (DEBUG_LOGS) console.log('[ConfigFactory] Rendering LLMConfig');
      return <LLMConfig nodeId={id} />;
    
    case 'api':
      if (DEBUG_LOGS) console.log('[ConfigFactory] Rendering APIConfig');
      return <APIConfig nodeId={id} />;
    
    case 'output':
      if (DEBUG_LOGS) console.log('[ConfigFactory] Rendering OutputConfig');
      return <OutputConfig nodeId={id} />;
    
    case 'input':
      if (DEBUG_LOGS) console.log('[ConfigFactory] Rendering InputNodeConfig');
      try {
        return <InputNodeConfig nodeId={id} />;
      } catch (error) {
        console.error('[ConfigFactory] Error rendering InputNodeConfig:', error);
        return (
          <div className="p-4 bg-red-50 border border-red-200 rounded-md">
            <h3 className="text-red-700 font-medium">Error rendering Input configuration</h3>
            <p className="text-red-600 text-sm mt-1">
              {error instanceof Error ? error.message : 'Unknown error'}
            </p>
          </div>
        );
      }
    
    case 'conditional':
      if (DEBUG_LOGS) console.log('[ConfigFactory] Rendering ConditionalNodeConfig');
      return <ConditionalNodeConfig nodeId={id} data={data as ConditionalNodeData} />;
    
    case 'group':
      if (DEBUG_LOGS) console.log('[ConfigFactory] Rendering GroupNodeConfig');
      return <GroupNodeConfig nodeId={id} data={data as GroupNodeData} />;
    
    case 'merger':
      if (DEBUG_LOGS) console.log('[ConfigFactory] Rendering MergerConfig');
      return <MergerConfig selectedNode={selectedNode as Node<MergerNodeData>} />;
    
    case 'web-crawler':
      if (DEBUG_LOGS) console.log('[ConfigFactory] Rendering WebCrawlerNodeConfig');
      return <WebCrawlerNodeConfig nodeId={id} />;
    
    case 'html-parser':
      if (DEBUG_LOGS) console.log('[ConfigFactory] Rendering HTMLParserNodeConfig');
      return <HTMLParserNodeConfig nodeId={id} />;
    
    default:
      if (DEBUG_LOGS) console.log(`[ConfigFactory] No config for node type: ${type}`);
      return (
        <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-md">
          <h3 className="text-yellow-700 font-medium">Configuration not implemented</h3>
          <p className="text-yellow-600 text-sm mt-1">
            The configuration panel for node type "{type}" is not yet available.
          </p>
        </div>
      );
  }
}, (prevProps, nextProps) => {
  // Revert memoization logic to original state
  if (!prevProps.selectedNode && !nextProps.selectedNode) return true;
  if (!prevProps.selectedNode || !nextProps.selectedNode) return false;
  
  return prevProps.selectedNode.id === nextProps.selectedNode.id &&
    prevProps.selectedNode.type === nextProps.selectedNode.type &&
    JSON.stringify(prevProps.selectedNode.data) === JSON.stringify(nextProps.selectedNode.data);
}); 