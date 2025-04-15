import React, { ChangeEvent } from 'react';

interface InputFileUploaderProps {
  onUpload: (e: ChangeEvent<HTMLInputElement>) => void;
  nodeId?: string;
  buttonLabel?: string;
}

export const InputFileUploader: React.FC<InputFileUploaderProps> = ({
  onUpload,
  nodeId,
  buttonLabel = '+ Add Files'
}) => {
  const inputId = nodeId ? `file-upload-${nodeId}` : 'file-upload';

  return (
    <div>
      <input
        type="file"
        id={inputId}
        onChange={onUpload}
        className="hidden"
        multiple
      />
      
      <label
        htmlFor={inputId}
        className="block w-full text-center py-2 px-4 bg-blue-100 hover:bg-blue-200 border border-blue-300 rounded-md text-blue-800 cursor-pointer font-medium"
      >
        {buttonLabel}
      </label>
    </div>
  );
}; 