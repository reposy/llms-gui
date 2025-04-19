import { VIEW_MODES, GlobalViewMode } from '../store/viewModeStore';
import { useStore as useViewModeStore, useGlobalViewMode } from '../store/viewModeStore';

const FlowToolbar: React.FC = () => {
  // Get globalViewMode and setGlobalViewMode from Zustand store
  const globalViewMode = useGlobalViewMode();
  const setGlobalViewMode = useViewModeStore(state => state.setGlobalViewMode);

  const handleViewModeChange = (mode: GlobalViewMode) => {
    setGlobalViewMode(mode);
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