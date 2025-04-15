import React from 'react';

interface Props {
  children: React.ReactNode;
}

export const NodeFooter: React.FC<Props> = ({ children }) => {
  return (
  <div className="relative px-4 py-2 border-t border-gray-200 bg-gray-50 rounded-b-lg flex items-center justify-end space-x-2">
      {children}
    </div>
  );
};

NodeFooter.displayName = 'NodeFooter'; 