import { Node } from 'reactflow';
import { NodeData } from '../../types/nodes';
import { NodeState } from '../../types/execution';

interface GroupNodesListProps {
  groupNodes: Node<NodeData>[];
}

export const GroupNodesList: React.FC<GroupNodesListProps> = ({ groupNodes }) => {
  return (
    <div className="mb-4 border-t pt-4 flex-shrink-0">
      <h3 className="text-md font-medium text-gray-700 mb-2">Nodes in Group ({groupNodes.length})</h3>
      {groupNodes.length > 0 ? (
        <ul className="space-y-1 text-xs max-h-32 overflow-y-auto border rounded-md p-1 bg-gray-50">
          {groupNodes.map((node) => (
            <li key={node.id} className="p-1 rounded-sm">
              {node.data.label || node.type || node.id} <span className="text-gray-500">({node.type})</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-gray-500 italic">No nodes defined in this group.</p>
      )}
    </div>
  );
};

export default GroupNodesList;
