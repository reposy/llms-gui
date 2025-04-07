import React, { ChangeEvent } from 'react';

interface InputTextManagerProps {
  textBuffer: string;
  onChange: (e: ChangeEvent<HTMLTextAreaElement>) => void;
  onAdd: () => void;
  placeholder?: string;
  height?: string;
  onKeyDown?: (e: React.KeyboardEvent) => void;
}

export const InputTextManager: React.FC<InputTextManagerProps> = ({
  textBuffer,
  onChange,
  onAdd,
  placeholder = "Enter text here...",
  height = "h-24",
  onKeyDown
}) => {
  return (
    <div>
      <textarea
        value={textBuffer}
        onChange={onChange}
        placeholder={placeholder}
        className={`w-full ${height} p-2 border border-gray-300 rounded-md bg-white resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent`}
        onKeyDown={onKeyDown || ((e) => e.stopPropagation())} // Prevent keyboard shortcuts from triggering when editing text
      />
      
      {/* Add Text button */}
      <div className="flex justify-end mt-2">
        <button
          onClick={onAdd}
          disabled={!textBuffer.trim()}
          className={`px-3 py-1 text-xs font-medium rounded ${
            textBuffer.trim()
              ? 'bg-blue-500 text-white hover:bg-blue-600'
              : 'bg-gray-300 text-gray-500 cursor-not-allowed'
          }`}
        >
          + Add Text
        </button>
      </div>
    </div>
  );
}; 