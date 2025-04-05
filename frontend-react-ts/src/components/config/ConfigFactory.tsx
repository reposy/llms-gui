import { Node } from 'reactflow';
import { 
  NodeData, 
  LLMNodeData, 
  APINodeData, 
  OutputNodeData, 
  JSONExtractorNodeData,
  InputNodeData,
  ConditionalNodeData,
  GroupNodeData,
  MergerNodeData
} from '../../types/nodes';

import { LLMConfig } from './LLMConfig';
import { APIConfig } from './APIConfig';
import { OutputConfig } from './OutputConfig';

// Import other config components as needed
// import { JSONExtractorConfig } from './JSONExtractorConfig';
// import { InputConfig } from './InputConfig';
// import { ConditionalConfig } from './ConditionalConfig';
// import { GroupConfig } from './GroupConfig';
// import { MergerConfig } from './MergerConfig';

interface ConfigFactoryProps {
  selectedNode: Node<NodeData> | null;
}

export const ConfigFactory: React.FC<ConfigFactoryProps> = ({ selectedNode }) => {
  if (!selectedNode) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500">
        No node selected
      </div>
    );
  }

  const { id, data, type } = selectedNode;

  // Return the appropriate config component based on node type
  switch (type) {
    case 'llm':
      return <LLMConfig nodeId={id} data={data as LLMNodeData} />;
    
    case 'api':
      return <APIConfig nodeId={id} data={data as APINodeData} />;
    
    case 'output':
      return <OutputConfig nodeId={id} data={data as OutputNodeData} />;
    
    // Add other node types as they are implemented
    // case 'json-extractor':
    //   return <JSONExtractorConfig nodeId={id} data={data as JSONExtractorNodeData} />;
    
    // case 'input':
    //   return <InputConfig nodeId={id} data={data as InputNodeData} />;
    
    // case 'conditional':
    //   return <ConditionalConfig nodeId={id} data={data as ConditionalNodeData} />;
    
    // case 'group':
    //   return <GroupConfig nodeId={id} data={data as GroupNodeData} />;
    
    // case 'merger':
    //   return <MergerConfig nodeId={id} data={data as MergerNodeData} />;
    
    default:
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