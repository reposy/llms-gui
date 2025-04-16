import React, { ChangeEvent } from 'react';

interface InputFileUploaderProps {
  onUpload: (files: FileList | null) => void;
  nodeId?: string;
  buttonLabel?: string;
  acceptedFileTypes?: string;
}

export const InputFileUploader: React.FC<InputFileUploaderProps> = ({
  onUpload,
  nodeId,
  buttonLabel = '+ Add Files',
  acceptedFileTypes = "image/*,text/*,.txt,.csv,.md,.json,.js,.ts,.html,.css,.xml,.yml,.yaml"
}) => {
  const inputId = nodeId ? `file-upload-${nodeId}` : 'file-upload';

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    onUpload(e.target.files);
  };

  return (
    <div>
      <input
        type="file"
        id={inputId}
        onChange={handleChange}
        className="hidden"
        multiple
        accept={acceptedFileTypes}
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