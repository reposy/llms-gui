import { useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../store/store';
import { GlobalViewMode, setGlobalViewMode, VIEW_MODES } from '../store/viewModeSlice';
import { useHotkeys } from 'react-hotkeys-hook';
import { FaUndo, FaRedo, FaCopy, FaPaste } from 'react-icons/fa';

const FlowToolbar: React.FC = () => {
  const dispatch = useDispatch();
  const globalViewMode = useSelector((state: RootState) => state.viewMode.globalViewMode);

  const handleViewModeChange = (mode: GlobalViewMode) => {
    dispatch(setGlobalViewMode(mode));
  };

  return (
    <div className="fixed top-4 right-4 flex items-center gap-2 p-2 bg-white rounded-lg shadow-lg border border-gray-200">
      <div className="text-sm font-medium text-gray-600">View Mode:</div>
      <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
        <button
          onClick={() => handleViewModeChange(VIEW_MODES.EXPANDED)}
          className={`px-2 py-1 text-xs font-medium rounded transition-colors ${
            globalViewMode === VIEW_MODES.EXPANDED 
              ? 'bg-white text-blue-700 shadow-sm' 
              : 'text-gray-600 hover:text-gray-900'
          }`}
          title="Show all node details"
        >
          Expanded
        </button>
        <button
          onClick={() => handleViewModeChange(VIEW_MODES.COMPACT)}
          className={`px-2 py-1 text-xs font-medium rounded transition-colors ${
            globalViewMode === VIEW_MODES.COMPACT 
              ? 'bg-white text-blue-700 shadow-sm' 
              : 'text-gray-600 hover:text-gray-900'
          }`}
          title="Show minimal node information"
        >
          Compact
        </button>
        <button
          onClick={() => handleViewModeChange(VIEW_MODES.AUTO)}
          className={`px-2 py-1 text-xs font-medium rounded transition-colors ${
            globalViewMode === VIEW_MODES.AUTO 
              ? 'bg-white text-blue-700 shadow-sm' 
              : 'text-gray-600 hover:text-gray-900'
          }`}
          title="Automatically adjust based on zoom level"
        >
          Auto
        </button>
      </div>
    </div>
  );
};

export default FlowToolbar; 