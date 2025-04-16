import React, { useState } from 'react';
import clsx from 'clsx';

interface InputTextManagerProps {
  onAddText: (text: string) => void;
  className?: string;
}

export const InputTextManagerNode: React.FC<InputTextManagerProps> = ({
  onAddText,
  className
}) => {
  const [textBuffer, setTextBuffer] = useState('');
  
  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setTextBuffer(e.target.value);
  };

  const handleAddText = () => {
    if (!textBuffer.trim()) return;
    
    onAddText(textBuffer);
    setTextBuffer(''); // Clear the text buffer after adding
  };

  return (
    <div className={clsx('space-y-2', className)}>
      <div className="mb-1 text-xs font-medium text-gray-500">Add Text</div>
      <textarea
        value={textBuffer}
        onChange={handleTextChange}
        placeholder="Enter text here..."
        className={clsx(
          'w-full px-2 py-1 text-sm',
          'border rounded',
          'focus:outline-none focus:ring-1 focus:ring-gray-500',
          'min-h-[60px] resize-y'
        )}
      />
      <button
        onClick={handleAddText}
        disabled={!textBuffer.trim()}
        className={clsx(
          'px-2 py-1 text-xs rounded transition-colors self-end ml-auto block',
          textBuffer.trim()
            ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            : 'bg-gray-100 text-gray-400 cursor-not-allowed'
        )}
      >
        Add Text
      </button>
    </div>
  );
}; 