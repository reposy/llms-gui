import { Node } from 'reactflow';
import { NodeData, GroupNodeData, InputNodeData } from '../../types/nodes';

interface GroupInfoBoxProps {
  groupNode?: Node<GroupNodeData>;
  sourceNode?: Node<InputNodeData>;
  sourceNodeId?: string;
  status: 'idle' | 'running' | 'success' | 'error' | 'skipped';
  error?: string;
  currentIterationIndex?: number;
  totalItems?: number;
}

export const GroupInfoBox: React.FC<GroupInfoBoxProps> = ({
  groupNode,
  sourceNode,
  sourceNodeId,
  status,
  error,
  currentIterationIndex,
  totalItems,
}) => {
  const inputItemsCount = sourceNode?.data.items?.length ?? 0;
  const groupId = groupNode?.id || '';
  
  return (
    <>
      <h2 className="text-lg font-semibold text-gray-800 mb-1 flex-shrink-0">
        Group: {groupNode?.data?.label || groupId}
      </h2>
      <p className="text-xs text-gray-500 mb-3 flex-shrink-0">
        Source: {sourceNode?.data.label || sourceNodeId || 'Not configured'} ({inputItemsCount} items)
      </p>

      <div className="mb-4 flex-shrink-0">
        {status === 'running' && (
          <div className="p-2 bg-blue-50 border border-blue-200 rounded-md text-sm text-blue-700">
            Running... Item {(currentIterationIndex ?? -1) + 1} / {totalItems || 'N/A'}
          </div>
        )}
        {status === 'error' && (
          <div className="p-2 bg-red-50 border border-red-200 rounded-md text-sm text-red-700">
            Error: {error}
          </div>
        )}
      </div>
    </>
  );
};

export default GroupInfoBox; 