import React from 'react';
import clsx from 'clsx';
import { InputFileUploader } from './InputFileUploader';

interface InputFileManagerProps {
  onFileUpload: (files: FileList | null) => void;
  nodeId: string;
  className?: string;
}

export const InputFileManager: React.FC<InputFileManagerProps> = ({
  onFileUpload,
  nodeId,
  className
}) => {
  return (
    <div className={clsx('space-y-2', className)}>
      <div className="mb-1 text-xs font-medium text-gray-500">Add Files</div>
      <InputFileUploader
        onUpload={onFileUpload}
        nodeId={nodeId}
        buttonLabel="+ Add Files"
        acceptedFileTypes="image/*,text/*,.txt,.csv,.md,.json,.js,.ts,.html,.css,.xml,.yml,.yaml"
        className="w-full"
      />
      <div className="text-xs text-gray-500 mt-1">
        Supports images and text files
      </div>
    </div>
  );
}; 