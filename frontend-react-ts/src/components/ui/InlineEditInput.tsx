import React, { useState, useRef, useEffect } from 'react';
import { CheckIcon, XIcon } from '../Icons';

interface InlineEditInputProps {
  value: string;
  onSave: (newValue: string) => void;
  onCancel: () => void;
  validate?: (v: string) => string | null;
  className?: string;
  [key: string]: any;
}

const InlineEditInput: React.FC<InlineEditInputProps> = ({
  value,
  onSave,
  onCancel,
  validate,
  className,
  ...props
}) => {
  const [inputValue, setInputValue] = useState(value);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setInputValue(value); }, [value]);

  const handleSave = () => {
    const err = validate?.(inputValue.trim()) ?? null;
    if (err) { setError(err); return; }
    onSave(inputValue.trim());
  };

  return (
    <span className={`flex items-center gap-1 ${className ?? ''}`}>
      <input
        ref={inputRef}
        value={inputValue}
        onChange={e => { setInputValue(e.target.value); setError(null); }}
        onBlur={handleSave}
        onKeyDown={e => {
          if (e.key === 'Enter') handleSave();
          if (e.key === 'Escape') onCancel();
        }}
        autoFocus
        className="border-b border-indigo-400 focus:outline-none px-1 py-0.5 text-sm bg-white rounded"
        style={{ minWidth: 60, maxWidth: 180 }}
        aria-label="이름 입력"
        {...props}
      />
      <button onClick={handleSave} className="ml-1 p-1 rounded hover:bg-green-100" title="저장"><CheckIcon size={16} /></button>
      <button onClick={onCancel} className="ml-1 p-1 rounded hover:bg-red-100" title="취소"><XIcon size={16} /></button>
      {error && <span className="text-xs text-red-500 ml-2">{error}</span>}
    </span>
  );
};

export default InlineEditInput; 