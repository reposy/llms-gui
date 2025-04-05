import { useSelector } from 'react-redux';
import { RootState } from '../../store/store';
import GroupResultItem from './GroupResultItem';
import { GroupExecutionItemResult } from '../../types/execution';

interface GroupResultListProps {
  status: 'idle' | 'running' | 'success' | 'error' | 'skipped';
  results?: GroupExecutionItemResult[];
}

export const GroupResultList: React.FC<GroupResultListProps> = ({ status, results }) => {
  return (
    <div className="flex-grow overflow-y-auto border-t pt-4">
      <h3 className="text-md font-medium text-gray-700 mb-2">Results</h3>
      
      {status === 'success' && Array.isArray(results) ? (
        results.length > 0 ? (
          <div className="space-y-3">
            {results.map((result, index) => (
              <GroupResultItem key={index} result={result} index={index} />
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-500 italic">
            Group executed successfully, but produced no results (or source was empty).
          </p>
        )
      ) : status === 'idle' ? (
        <p className="text-sm text-gray-500 italic">Group has not been executed yet.</p>
      ) : status === 'running' ? (
        <p className="text-sm text-gray-500 italic">Execution in progress...</p>
      ) : status === 'error' ? (
        <p className="text-sm text-red-500 italic">Execution failed. See error message above.</p>
      ) : status === 'skipped' ? (
        <p className="text-sm text-gray-500 italic">Group execution was skipped.</p>
      ) : (
        <p className="text-sm text-gray-500 italic">No results available.</p>
      )}
    </div>
  );
};

export default GroupResultList; 