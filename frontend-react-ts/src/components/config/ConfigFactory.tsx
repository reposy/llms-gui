import { Node } from 'reactflow';
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
import { MergerNodeConfig } from './MergerNodeConfig';
import { WebCrawlerNodeConfig } from './WebCrawlerNodeConfig';

interface ConfigFactoryProps {
  selectedNode: Node<NodeData> | null;
}

export const ConfigFactory: React.FC<ConfigFactoryProps> = ({ selectedNode }) => {
  if (!selectedNode) {
    console.log('[ConfigFactory] No node selected');
    return (
      <div className="flex items-center justify-center h-full text-gray-500">
        No node selected
      </div>
    );
  }

  const { id, data, type } = selectedNode;
  console.log(`[ConfigFactory] Rendering config for node: ${id}, type: ${type}`);

  // Return the appropriate config component based on node type
  switch (type) {
    case 'llm':
      console.log('[ConfigFactory] Rendering LLMConfig');
      return <LLMConfig nodeId={id} data={data as LLMNodeData} />;
    
    case 'api':
      console.log('[ConfigFactory] Rendering APIConfig');
      return <APIConfig nodeId={id} data={data as APINodeData} />;
    
    case 'output':
      console.log('[ConfigFactory] Rendering OutputConfig');
      return <OutputConfig nodeId={id} data={data as OutputNodeData} />;
    
    case 'input':
      console.log('[ConfigFactory] Rendering InputNodeConfig');
      try {
        return <InputNodeConfig nodeId={id} data={data as InputNodeData} />;
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
      console.log('[ConfigFactory] Rendering ConditionalNodeConfig');
      return <ConditionalNodeConfig nodeId={id} data={data as ConditionalNodeData} />;
    
    case 'group':
      console.log('[ConfigFactory] Rendering GroupNodeConfig');
      return <GroupNodeConfig nodeId={id} data={data as GroupNodeData} />;
    
    case 'merger':
      console.log('[ConfigFactory] Rendering MergerNodeConfig');
      return <MergerNodeConfig nodeId={id} data={data as MergerNodeData} />;
    
    case 'web-crawler':
      console.log('[ConfigFactory] Rendering WebCrawlerNodeConfig');
      return <WebCrawlerNodeConfig nodeId={id} data={data as WebCrawlerNodeData} />;
    
    default:
      console.log(`[ConfigFactory] No config for node type: ${type}`);
      return (
        <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-md">
          <h3 className="text-yellow-700 font-medium">Configuration not implemented</h3>
          <p className="text-yellow-600 text-sm mt-1">
            The configuration panel for node type "{type}" is not yet available.
          </p>
        </div>
      );
  }
}; 