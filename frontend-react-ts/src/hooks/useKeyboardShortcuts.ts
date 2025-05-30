import { useEffect, useCallback } from 'react';
import { useReactFlow } from '@xyflow/react';

interface KeyboardShortcutHandlers {
  onCopy?: () => void;
  onPaste?: (position?: { x: number, y: number }) => void;
  onCut?: () => void;
  onDuplicate?: () => void;
  onDelete?: () => void;
  onUndo?: () => void;
  onRedo?: () => void;
}

export const useKeyboardShortcuts = (handlers: KeyboardShortcutHandlers): void => {
  const reactFlowInstance = useReactFlow();
  const { screenToFlowPosition } = reactFlowInstance;

  const { 
    onCopy, 
    onPaste, 
    onCut, 
    onDuplicate, 
    onDelete, 
    onUndo, 
    onRedo 
  } = handlers;

  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    const targetElement = event.target as HTMLElement;
    const isInputFocused = 
      targetElement.tagName === 'INPUT' || 
      targetElement.tagName === 'TEXTAREA' || 
      targetElement.isContentEditable;

    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
    const isCtrlOrCmd = isMac ? event.metaKey : event.ctrlKey;

    // --- Handle Meta Key Shortcuts (Cmd/Ctrl) ---
    if (isCtrlOrCmd) {
      switch (event.key.toLowerCase()) {
        case 'c':
          if (!isInputFocused && onCopy) {
            onCopy();
            event.preventDefault();
          }
          break;
        case 'v':
          if (!isInputFocused && onPaste) {
            // Calculate center position for paste
            const centerPosition = screenToFlowPosition({
              x: window.innerWidth / 2,
              y: window.innerHeight / 2
            });
            onPaste(centerPosition);
            event.preventDefault();
          }
          break;
        case 'x':
          if (!isInputFocused && onCut) {
            onCut();
            event.preventDefault();
          }
          break;
        case 'd':
          if (onDuplicate) { 
            onDuplicate();
            event.preventDefault(); 
          }
          break;
        case 'z':
          if (!isInputFocused) {
            if (event.shiftKey && onRedo) {
              onRedo();
              event.preventDefault();
            } else if (!event.shiftKey && onUndo) {
              onUndo();
              event.preventDefault();
            }
          }
          break;
        default:
          break;
      }
    } 
    // --- Handle Non-Meta Key Shortcuts ---
    else {
      switch (event.key) {
        case 'Delete':
        case 'Backspace':
          if (!isInputFocused && onDelete) {
            onDelete();
            event.preventDefault(); 
          }
          break;
        case 'Insert': 
           if (event.shiftKey && !isInputFocused && onPaste) {
             // Calculate center position for paste with Shift+Insert too
             const centerPosition = screenToFlowPosition({
               x: window.innerWidth / 2,
               y: window.innerHeight / 2
             });
             onPaste(centerPosition);
             event.preventDefault();
           }
           break;
        default:
          break;
      }
    }
  }, [onCopy, onPaste, onCut, onDuplicate, onDelete, onUndo, onRedo, screenToFlowPosition]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown]); 
}; 