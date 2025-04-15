import React, { useEffect } from 'react';
import { useReactFlow } from 'reactflow';
import { VIEW_MODES, GlobalViewMode } from '../../store/viewModeStore';
import { useStore as useViewModeStore } from '../../store/viewModeStore';

interface LLMNodeViewControllerProps {
  id: string;
  children: React.ReactNode;
}

export const LLMNodeViewController: React.FC<LLMNodeViewControllerProps> = ({
  id,
  children
}) => {
  const { getZoom } = useReactFlow();
  // Get global view mode and setNodeViewMode from Zustand store
  const globalViewMode = useViewModeStore(state => state.globalViewMode) as GlobalViewMode;
  const setNodeViewMode = useViewModeStore(state => state.setNodeViewMode);

  // Auto-collapse based on zoom level if in auto mode
  useEffect(() => {
    if (globalViewMode === VIEW_MODES.AUTO) {
      const zoom = getZoom();
      const shouldBeCompact = zoom < 0.7;
      setNodeViewMode({ 
        nodeId: id, 
        mode: shouldBeCompact ? VIEW_MODES.COMPACT : VIEW_MODES.EXPANDED 
      });
    }
  }, [globalViewMode, getZoom, id, setNodeViewMode]);

  return <>{children}</>;
}; 