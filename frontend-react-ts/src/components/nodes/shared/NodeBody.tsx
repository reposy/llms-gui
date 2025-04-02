import React from 'react';

interface Props {
  children: React.ReactNode;
}

export const NodeBody: React.FC<Props> = ({ children }) => {
  return (
    <div className="p-4">
      {children}
    </div>
  );
};

NodeBody.displayName = 'NodeBody'; 