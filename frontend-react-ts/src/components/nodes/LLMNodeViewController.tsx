import React, { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useReactFlow } from 'reactflow';
import { setNodeViewMode, VIEW_MODES, GlobalViewMode } from '../../store/viewModeSlice';
import { RootState } from '../../store/store';

interface LLMNodeViewControllerProps {
  id: string;
  children: React.ReactNode;
}

export const LLMNodeViewController: React.FC<LLMNodeViewControllerProps> = ({
  id,
  children
}) => {
  const dispatch = useDispatch();
  const { getZoom } = useReactFlow();
  const globalViewMode = useSelector(
    (state: RootState) => state.viewMode.globalViewMode
  ) as GlobalViewMode;

  // Auto-collapse based on zoom level if in auto mode
  useEffect(() => {
    if (globalViewMode === VIEW_MODES.AUTO) {
      const zoom = getZoom();
      const shouldBeCompact = zoom < 0.7;
      dispatch(setNodeViewMode({ 
        nodeId: id, 
        mode: shouldBeCompact ? VIEW_MODES.COMPACT : VIEW_MODES.EXPANDED 
      }));
    }
  }, [globalViewMode, getZoom, id, dispatch]);

  return <>{children}</>;
}; 