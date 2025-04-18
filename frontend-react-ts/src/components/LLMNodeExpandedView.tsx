import React from 'react';
import { shallow } from 'zustand/shallow';
import { useNodeContentStore } from '../store/useNodeContentStore';

interface LLMNodeExpandedViewProps {
  nodeId: string;
}

const LLMNodeExpandedView: React.FC<LLMNodeExpandedViewProps> = ({ nodeId }) => {
  const nodeContent = useNodeContentStore(
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