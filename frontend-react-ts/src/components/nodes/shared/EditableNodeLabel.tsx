import React, { useState, useCallback, useEffect } from 'react';
import clsx from 'clsx';

interface Props {
  initialLabel: string;
  nodeId: string; // Needed for dispatching updates
  onLabelUpdate: (nodeId: string, newLabel: string) => void; // Callback to dispatch the update
  placeholderLabel?: string; // e.g., 'LLM', 'API'
  labelClassName?: string; // Base classes for the label display
  inputClassName?: string; // Base classes for the input field
  editingInputWidthFactor?: number; // Multiplier for dynamic width calculation
}

export const EditableNodeLabel: React.FC<Props> = React.memo(({
  initialLabel,
  nodeId,
  onLabelUpdate,
  placeholderLabel = 'Node',
  labelClassName = 'font-bold',
  inputClassName = 'px-1 py-0.5 text-sm font-bold border rounded focus:outline-none focus:ring-1',
  editingInputWidthFactor = 8,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [labelDraft, setLabelDraft] = useState(initialLabel);

  useEffect(() => {
    // Update draft if initial label changes externally (and not currently editing)
    if (!isEditing) {
      setLabelDraft(initialLabel);
    }
  }, [initialLabel, isEditing]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setLabelDraft(e.target.value);
  }, []);

  const handleBlur = useCallback(() => {
    setIsEditing(false);
    const trimmedLabel = labelDraft.trim();
    if (trimmedLabel !== initialLabel) {
      console.log(`[EditableNodeLabel] Calling onLabelUpdate for ${nodeId} with label:`, trimmedLabel || placeholderLabel);
      onLabelUpdate(nodeId, trimmedLabel || placeholderLabel);
    } else {
      // Optionally revert draft if no change
      // setLabelDraft(initialLabel);
    }
  }, [initialLabel, labelDraft, nodeId, onLabelUpdate, placeholderLabel]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      e.currentTarget.blur(); // Trigger blur to save
    } else if (e.key === 'Escape') {
      setIsEditing(false);
      setLabelDraft(initialLabel); // Revert changes
    }
  }, [initialLabel]);

  if (isEditing) {
    return (
      <input
        type="text"
        value={labelDraft}
        onChange={handleChange}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        className={clsx(inputClassName)} // Allow specific theme colors via parent
        autoFocus
        style={{ width: `${Math.max(labelDraft.length * editingInputWidthFactor, 60)}px` }}
      />
    );
  }

  return (
    <div
      onClick={() => setIsEditing(true)}
      className={clsx(labelClassName, 'cursor-text px-1 py-0.5 rounded')} // Add base interactive styles
      title="Click to edit node name"
    >
      {initialLabel}
    </div>
  );
});

EditableNodeLabel.displayName = 'EditableNodeLabel'; 