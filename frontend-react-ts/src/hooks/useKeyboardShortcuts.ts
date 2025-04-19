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
  console.log('[KeyboardShortcut DEBUG] Hook called/re-rendered.'); // Log hook execution
  
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
    console.log(`[KeyboardShortcut DEBUG] handleKeyDown triggered: Key=${event.key}, Ctrl=${event.ctrlKey}, Meta=${event.metaKey}`); // Log handler execution
    
    const targetElement = event.target as HTMLElement;
    const isInputFocused = 
      targetElement.tagName === 'INPUT' || 
      targetElement.tagName === 'TEXTAREA' || 
      targetElement.isContentEditable;
    
    console.log(`[KeyboardShortcut DEBUG] Target element: ${targetElement.tagName}, isInputFocused: ${isInputFocused}`);

    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
    const isCtrlOrCmd = isMac ? event.metaKey : event.ctrlKey;
    console.log(`[KeyboardShortcut DEBUG] isMac: ${isMac}, isCtrlOrCmd: ${isCtrlOrCmd}`);

    // --- Handle Meta Key Shortcuts (Cmd/Ctrl) ---
    if (isCtrlOrCmd) {
      console.log(`[KeyboardShortcut DEBUG] Meta key pressed, checking key: ${event.key.toLowerCase()}`);
      switch (event.key.toLowerCase()) {
        case 'c':
          console.log(`[KeyboardShortcut DEBUG] 'c' key detected, isInputFocused: ${isInputFocused}, onCopy exists: ${!!onCopy}`);
          if (!isInputFocused && onCopy) {
            console.log('[KeyboardShortcut DEBUG] Calling onCopy...');
            onCopy();
            event.preventDefault();
            console.log('[KeyboardShortcut DEBUG] onCopy called and event prevented');
          }
          break;
        case 'v':
          console.log(`[KeyboardShortcut DEBUG] 'v' key detected, isInputFocused: ${isInputFocused}, onPaste exists: ${!!onPaste}`);
          if (!isInputFocused && onPaste) {
            console.log('[KeyboardShortcut DEBUG] Calling onPaste...');
            // Calculate center position for paste
            const centerPosition = screenToFlowPosition({
              x: window.innerWidth / 2,
              y: window.innerHeight / 2
            });
            console.log('[KeyboardShortcut DEBUG] Center position calculated:', centerPosition);
            onPaste(centerPosition);
            event.preventDefault();
            console.log('[KeyboardShortcut DEBUG] onPaste called and event prevented');
          }
          break;
        case 'x':
          if (!isInputFocused && onCut) {
            console.log('[KeyboardShortcut DEBUG] Calling onCut...');
            onCut();
            event.preventDefault();
          }
          break;
        case 'd':
          if (onDuplicate) { 
            console.log('[KeyboardShortcut DEBUG] Calling onDuplicate...');
            onDuplicate();
            event.preventDefault(); 
          }
          break;
        case 'z':
          if (!isInputFocused) {
            if (event.shiftKey && onRedo) {
              console.log('[KeyboardShortcut DEBUG] Calling onRedo...');
              onRedo();
              event.preventDefault();
            } else if (!event.shiftKey && onUndo) {
              console.log('[KeyboardShortcut DEBUG] Calling onUndo...');
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
            console.log('[KeyboardShortcut DEBUG] Calling onDelete...');
            onDelete();
            event.preventDefault(); 
          }
          break;
        case 'Insert': 
           if (event.shiftKey && !isInputFocused && onPaste) {
             console.log('[KeyboardShortcut DEBUG] Calling onPaste (Shift+Insert)...');
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
    console.log('[KeyboardShortcut DEBUG] Adding keydown listener.'); // Log listener addition
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      console.log('[KeyboardShortcut DEBUG] Removing keydown listener.'); // Log listener removal
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown]); 
}; 