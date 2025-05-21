import React, { useState } from 'react';
import { FlowChainList } from '../components/FlowExecutor/FlowChainList';
import { FlowChainDetail } from '../components/FlowExecutor/FlowChainDetail';
import { FlowChainModal } from '../components/FlowExecutor/FlowChainModal';

export const FlowExecutor: React.FC = () => {
  const [selectedFlow, setSelectedFlow] = useState<{ chainId: string; flowId: string } | null>(null);

  return (
    <div className="h-screen flex flex-col">
      <div className="flex-grow flex overflow-hidden">
        <div className="w-1/4 border-r border-gray-200 h-full overflow-auto">
          <FlowChainList />
        </div>
        <div className="w-3/4 h-full overflow-auto">
          <FlowChainDetail onFlowSelect={(chainId, flowId) => setSelectedFlow({ chainId, flowId })} />
        </div>
      </div>
      {selectedFlow && (
        <FlowChainModal
          chainId={selectedFlow.chainId}
          flowId={selectedFlow.flowId}
          open={!!selectedFlow}
          onClose={() => setSelectedFlow(null)}
        />
      )}
    </div>
  );
}; 