import React from 'react';
import { ReactFlowProvider } from '@xyflow/react';
import { FlowEditor } from '../components/FlowEditor';

const FlowEditorPage: React.FC = () => {
  return (
    <div className="h-screen w-screen overflow-hidden">
      <ReactFlowProvider>
        <FlowEditor />
      </ReactFlowProvider>
    </div>
  );
};

export default FlowEditorPage; 