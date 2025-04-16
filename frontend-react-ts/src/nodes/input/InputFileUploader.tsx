import React, { useRef } from 'react';
import clsx from 'clsx';

interface InputFileUploaderProps {
  onUpload: (files: FileList | null) => void;
  nodeId: string;
  buttonLabel?: string;
  acceptedFileTypes?: string;
  className?: string;
}

export const InputFileUploader: React.FC<InputFileUploaderProps> = ({
  onUpload,
  nodeId,
  buttonLabel = 'Upload Files',
  acceptedFileTypes,
  className
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleButtonClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    onUpload(files);

    // Reset the input so the same file can be uploaded again if needed
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className={clsx('file-uploader', className)}>
      <input
        ref={fileInputRef}
        type="file"
        id={`file-input-${nodeId}`}
        multiple
        accept={acceptedFileTypes}
        onChange={handleFileChange}
        className="hidden"
        aria-label="Upload files"
      />
      <button
        onClick={handleButtonClick}
        className={clsx(
          'px-2 py-1 text-xs rounded transition-colors',
          'bg-blue-50 text-blue-600 hover:bg-blue-100 border border-blue-200',
          'focus:outline-none focus:ring-1 focus:ring-blue-400'
        )}
        type="button"
      >
        {buttonLabel}
      </button>
    </div>
  );
}; 