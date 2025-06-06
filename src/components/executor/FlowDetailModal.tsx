const FlowDetailModal: React.FC<FlowDetailModalProps> = ({ 
  isOpen, 
  onClose, 
  flow, 
  flowChainId,
  flowChainMap,
  allFlowChainIds,
  mode = 'both'
}) => {
  if (!isOpen || !flow) {
    return null;
  }

  const handleExecute = (mode: ExecutionMode, inputData: any) => {
    // ... existing code ...
  };

  // ... existing code ...
}; 