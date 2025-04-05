import { Node } from 'reactflow';
import { GroupNodeData } from '../../types/nodes';
import { GroupExecutionItemResult } from '../../types/execution';

interface GroupExecutionToolbarProps {
  groupNode?: Node<GroupNodeData>;
  status: 'idle' | 'running' | 'success' | 'error' | 'skipped';
  results?: GroupExecutionItemResult[];
  onRunGroup: () => void;
  onExportJson: () => void;
}

export const GroupExecutionToolbar: React.FC<GroupExecutionToolbarProps> = ({
  status,
  results,
  onRunGroup,
  onExportJson,
}) => {
  const hasResults = status === 'success' && Array.isArray(results) && results.length > 0;

  return (
    <div className="mt-auto pt-4 border-t flex-shrink-0 space-y-2">
      <button
        className="w-full px-4 py-2 rounded-lg bg-gradient-to-r from-orange-500 to-orange-600 text-white shadow-md hover:shadow-lg transition-all duration-200 flex items-center justify-center gap-2 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
        onClick={onRunGroup}
        disabled={status === 'running'}
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        {status === 'running' ? 'Running Group...' : 'Run Group'}
      </button>

      <button
        className="w-full px-4 py-2 rounded-lg bg-gradient-to-r from-gray-500 to-gray-600 text-white shadow-md hover:shadow-lg transition-all duration-200 flex items-center justify-center gap-2 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
        onClick={onExportJson}
        disabled={!hasResults}
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
        </svg>
        Export JSON
      </button>
    </div>
  );
};

export default GroupExecutionToolbar; 