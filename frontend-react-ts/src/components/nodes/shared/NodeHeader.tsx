import { memo } from 'react';
import clsx from 'clsx';
import { EditableNodeLabel } from './EditableNodeLabel';
import { VIEW_MODES } from '../../../store/viewModeSlice';
import { FaCircle } from 'react-icons/fa'; // Example icon for dirty state

interface Props {
  nodeId: string;
  label: string;
  placeholderLabel: string;
  isRootNode: boolean;
  isRunning: boolean;
  isContentDirty?: boolean; // Add optional prop
  viewMode: typeof VIEW_MODES.COMPACT | typeof VIEW_MODES.EXPANDED;
  themeColor: 'blue' | 'green' | 'purple' | 'gray' | 'orange'; // For theming buttons/labels
  onRun: () => void;
  onLabelUpdate: (nodeId: string, newLabel: string) => void;
  onToggleView: () => void;
}

// Helper to get theme classes
const getThemeClasses = (color: Props['themeColor']) => {
  const baseInputClasses = 'bg-white text-gray-800'; // Ensure consistent background and text
  switch (color) {
    case 'blue':
      return {
        runButton: 'bg-blue-100 text-blue-700 hover:bg-blue-200',
        label: 'text-blue-500 hover:bg-blue-50',
        input: `${baseInputClasses} border-blue-200 focus:ring-blue-500`, // Combine base + theme border/focus
      };
    case 'green':
      return {
        runButton: 'bg-green-100 text-green-700 hover:bg-green-200',
        label: 'text-green-500 hover:bg-green-50',
        input: `${baseInputClasses} border-green-200 focus:ring-green-500`, // Combine base + theme border/focus
      };
    case 'purple':
      return {
        runButton: 'bg-purple-100 text-purple-700 hover:bg-purple-200',
        label: 'text-purple-500 hover:bg-purple-50',
        input: `${baseInputClasses} border-purple-200 focus:ring-purple-500`, // Combine base + theme border/focus
      };
    case 'orange':
      return {
        runButton: 'bg-orange-100 text-orange-700 hover:bg-orange-200',
        label: 'text-orange-600 hover:bg-orange-50',
        input: `${baseInputClasses} border-orange-200 focus:ring-orange-500`, // Combine base + theme border/focus
      };
    case 'gray': // Fallback/default theme
    default:
      return {
        runButton: 'bg-gray-100 text-gray-700 hover:bg-gray-200',
        label: 'text-gray-700 hover:bg-gray-50',
        input: `${baseInputClasses} border-gray-200 focus:ring-gray-500`, // Combine base + theme border/focus
      };
  }
};

export const NodeHeader: React.FC<Props> = memo(({
  nodeId,
  label,
  placeholderLabel,
  isRootNode,
  isRunning,
  isContentDirty, // Destructure prop
  viewMode,
  themeColor,
  onRun,
  onLabelUpdate,
  onToggleView,
}) => {
  const theme = getThemeClasses(themeColor);

  return (
    <div className="flex items-center justify-between mb-2">
      <div className="flex items-center gap-2">
        {/* Run Button */} 
        {isRootNode ? (
          <button
            onClick={onRun}
            className={clsx(
              'relative shrink-0 px-2 py-1 text-xs font-medium rounded transition-colors',
              theme.runButton
            )}
            title="Run full flow from this node"
          >
            {/* Optional: Add indicator for dirty state ON the run button? */}
            {/* {isContentDirty && <FaCircle className="absolute -top-1 -right-1 text-yellow-400 text-[8px]" />} */} 
            {isRunning ? '⏳' : '▶'} Run
          </button>
        ) : (
          <div 
            className="shrink-0 px-2 py-1 text-xs font-medium bg-gray-100 text-gray-400 rounded cursor-not-allowed"
            title="Only root nodes can be executed"
          >
            ▶
          </div>
        )}
        
        {/* Editable Label with Dirty Indicator */}
        <div className="flex items-center gap-1">
            <EditableNodeLabel
              nodeId={nodeId}
              initialLabel={label}
              placeholderLabel={placeholderLabel}
              onLabelUpdate={onLabelUpdate}
              labelClassName={clsx('font-bold', theme.label)} 
              inputClassName={clsx('px-1 py-0.5 text-sm font-bold border rounded focus:outline-none focus:ring-1', theme.input)}
            />
            {/* Display dirty indicator next to label */}
            {isContentDirty && (
                <span title="Unsaved changes">
                  <FaCircle className="text-yellow-400 text-[8px]" />
                </span>
            )}
        </div>

        {/* View Toggle Button */}
        <button
          onClick={onToggleView}
          className="shrink-0 w-6 h-6 flex items-center justify-center text-xs text-gray-400 hover:text-gray-600 transition-colors rounded hover:bg-gray-100"
          title={viewMode === VIEW_MODES.COMPACT ? 'Show more details' : 'Show less details'}
        >
          {viewMode === VIEW_MODES.COMPACT ? '⌄' : '⌃'}
        </button>
      </div>
    </div>
  );
});

NodeHeader.displayName = 'NodeHeader'; 