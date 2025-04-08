import { useCallback, useEffect } from 'react';
import { useReactFlow, XYPosition } from 'reactflow';
import { NodeData } from '../types/nodes';
import { 
  copySelectedNodes, 
  pasteClipboardContents, 
  hasClipboardData 
} from '../utils/clipboardUtils';

export interface UseClipboardReturnType {
  handleCopy: () => void;
  handlePaste: (position?: XYPosition) => void;
  canPaste: boolean;
}

export const useClipboard = (): UseClipboardReturnType => {
  const { getViewport } = useReactFlow<NodeData>();

  const handleCopy = useCallback(() => {
    const nodeCount = copySelectedNodes();
    if (nodeCount > 0) {
      console.log(`[Clipboard] Copied ${nodeCount} nodes`);
    }
  }, []);

  const handlePaste = useCallback((mousePosition?: XYPosition) => {
    // If no position is provided, calculate a position based on the viewport center
    if (!mousePosition) {
      const viewport = getViewport();
      // Use window dimensions to calculate center
      const position = {
        x: -viewport.x / viewport.zoom + window.innerWidth / 2 / viewport.zoom,
        y: -viewport.y / viewport.zoom + window.innerHeight / 2 / viewport.zoom,
      };
      pasteClipboardContents(position);
    } else {
      pasteClipboardContents(mousePosition);
    }
  }, [getViewport]);

  // Set up keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Check if Ctrl/Cmd + C is pressed (copy)
      if ((event.ctrlKey || event.metaKey) && event.key === 'c') {
        event.preventDefault();
        handleCopy();
      }
      
      // Check if Ctrl/Cmd + V is pressed (paste)
      if ((event.ctrlKey || event.metaKey) && event.key === 'v') {
        event.preventDefault();
        handlePaste();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    
    // Cleanup on unmount
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleCopy, handlePaste]);

  // Check if we have data to paste
  const canPaste = hasClipboardData();

  return {
    handleCopy,
    handlePaste,
    canPaste
  };
}; 