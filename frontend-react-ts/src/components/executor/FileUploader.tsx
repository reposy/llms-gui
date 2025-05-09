import React, { useState, useRef } from 'react';

interface FileUploaderProps {
  onFileUpload: (jsonData: any) => void;
}

const FileUploader: React.FC<FileUploaderProps> = ({ onFileUpload }) => {
  const [fileName, setFileName] = useState<string>('');
  const [error, setError] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setError('');

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const json = JSON.parse(e.target?.result as string);
        onFileUpload(json);
      } catch (err) {
        setError('Invalid JSON file. Please upload a valid Flow JSON file.');
      }
    };
    reader.onerror = () => {
      setError('Error reading file.');
    };
    reader.readAsText(file);
  };

  const handleButtonClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="mb-6 p-4 border border-gray-300 rounded-lg bg-white">
      <h2 className="text-lg font-medium mb-3">Upload Flow JSON</h2>
      <div className="flex flex-col space-y-2">
        <input
          type="file"
          accept=".json"
          ref={fileInputRef}
          onChange={handleFileChange}
          className="hidden"
        />
        <div className="flex items-center">
          <button
            onClick={handleButtonClick}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
          >
            Browse Files
          </button>
          <span className="ml-3 text-gray-600">
            {fileName || 'No file selected'}
          </span>
        </div>
        {error && <p className="text-red-500 text-sm">{error}</p>}
      </div>
    </div>
  );
};

export default FileUploader; 