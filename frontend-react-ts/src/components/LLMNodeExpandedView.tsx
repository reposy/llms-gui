import React from 'react';
import { shallow } from 'zustand/shallow';
import { useNodePropertyStore } from '../store/useNodePropertyStore';

interface LLMNodeExpandedViewProps {
  nodeId: string;
}

const LLMNodeExpandedView: React.FC<LLMNodeExpandedViewProps> = ({ nodeId }) => {
  const nodeContent = useNodePropertyStore(
    state => state.contents[nodeId] || {},
    shallow
  );
  
  return (
    <div>
      {/* Your component content here */}
    </div>
  );
};

export default LLMNodeExpandedView; 