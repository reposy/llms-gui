import React from 'react';
import { NodeType } from '../types/nodes';

interface Props {
  type: NodeType;
  label: string;
  isExecuting: boolean;
  onExecute?: () => void;
  children: React.ReactNode;
}

const NodeWrapper: React.FC<Props> = ({ type, label, isExecuting, onExecute, children }) => {
  const getTypeColor = () => {
    switch (type) {
      case 'llm':
        return 'blue';
      case 'api':
        return 'green';
      case 'output':
        return 'purple';
      default:
        return 'gray';
    }
  };

  const color = getTypeColor();

  return (
    <div className={`px-4 py-2 shadow-md rounded-md bg-white border-2 border-${color}-500 min-w-[200px]`}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center">
          <div className={`w-3 h-3 bg-${color}-500 rounded-full mr-2`} />
          <div className={`font-bold text-${color}-500`}>{label}</div>
        </div>
        {onExecute && (
          <button
            onClick={onExecute}
            disabled={isExecuting}
            className={`flex items-center justify-center gap-1 px-3 py-1 text-sm text-white bg-${color}-500 rounded hover:bg-${color}-600 disabled:bg-${color}-300 disabled:cursor-not-allowed flex-shrink-0 ml-2`}
          >
            {isExecuting ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                실행중
              </>
            ) : (
              '실행'
            )}
          </button>
        )}
      </div>
      {children}
    </div>
  );
};

export default NodeWrapper; 