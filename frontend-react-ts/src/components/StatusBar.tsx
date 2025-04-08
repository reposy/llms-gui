import React from 'react';
import { useCanUndo, useCanRedo } from '../store/useHistoryStore';
import { useIsDirty } from '../store/useDirtyTracker';

/**
 * Status bar component to show undo/redo state and dirty flag
 * This is a debug component for demonstration purposes
 */
export const StatusBar: React.FC = () => {
  const canUndo = useCanUndo();
  const canRedo = useCanRedo();
  const isDirty = useIsDirty();
  
  return (
    <div className="fixed bottom-0 right-0 bg-gray-800 text-white text-xs px-4 py-2 rounded-tl-md opacity-80 flex items-center gap-2">
      <div className="flex items-center gap-1">
        <span className="font-semibold">History:</span>
        <span className={canUndo ? 'text-green-400' : 'text-gray-500'}>
          Undo {canUndo ? '✓' : '✗'}
        </span>
        <span className="text-gray-500">|</span>
        <span className={canRedo ? 'text-green-400' : 'text-gray-500'}>
          Redo {canRedo ? '✓' : '✗'}
        </span>
      </div>
      <div className="h-4 w-px bg-gray-500 mx-2"></div>
      <div className="flex items-center gap-1">
        <span className="font-semibold">State:</span>
        <span className={isDirty ? 'text-yellow-400' : 'text-green-400'}>
          {isDirty ? 'Unsaved*' : 'Saved'}
        </span>
      </div>
      <div className="h-4 w-px bg-gray-500 mx-2"></div>
      <div className="text-gray-400">
        <span>⌘Z: Undo</span>
        <span className="mx-1">|</span>
        <span>⌘⇧Z: Redo</span>
      </div>
    </div>
  );
}; 