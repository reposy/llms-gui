import React, { ChangeEvent, useState } from 'react';

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
  const [showTooltip, setShowTooltip] = useState(false);
  const isDisabled = !textBuffer.trim();

  return (
    <div>
      <textarea
        value={textBuffer}
        onChange={onChange}
        placeholder={placeholder}
        className={`w-full ${height} p-2 border border-gray-300 rounded-md bg-white resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent`}
        onKeyDown={onKeyDown || ((e) => e.stopPropagation())} // Prevent keyboard shortcuts from triggering when editing text
      />
      
      {/* Add Text button with tooltip */}
      <div className="flex justify-end mt-2 relative">
        <button
          onClick={onAdd}
          disabled={isDisabled}
          className={`px-3 py-1 text-xs font-medium rounded ${
            !isDisabled
              ? 'bg-blue-500 text-white hover:bg-blue-600'
              : 'bg-gray-300 text-gray-500 cursor-not-allowed'
          }`}
          title={isDisabled ? "Enter some text to enable this button" : ""}
          onMouseEnter={() => setShowTooltip(isDisabled)}
          onMouseLeave={() => setShowTooltip(false)}
          onFocus={() => setShowTooltip(isDisabled)}
          onBlur={() => setShowTooltip(false)}
        >
          + Add Text
        </button>
        
        {/* Custom tooltip that appears only when button is disabled and hovered */}
        {showTooltip && (
          <div className="absolute bottom-full mb-1 right-0 bg-gray-800 text-white text-xs rounded py-1 px-2 whitespace-nowrap">
            Enter some text to enable this button
            <div className="absolute top-full right-2 w-2 h-2 bg-gray-800 transform rotate-45"></div>
          </div>
        )}
      </div>
    </div>
  );
}; 