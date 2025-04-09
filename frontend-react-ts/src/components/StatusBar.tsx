import React, { useEffect, useState } from 'react';
import { useCanUndo, useCanRedo } from '../store/useHistoryStore';
import { useIsDirty } from '../store/useDirtyTracker';
import { useNodes, useEdges, useSelectedNodeId, useFlowStructureStore } from '../store/useFlowStructureStore';

/**
 * Status bar component to show undo/redo state and dirty flag
 * This is a debug component for demonstration purposes
 */
export const StatusBar: React.FC = () => {
  const canUndo = useCanUndo();
  const canRedo = useCanRedo();
  const isDirty = useIsDirty();
  const nodes = useNodes();
  const edges = useEdges();
  const selectedNodeId = useSelectedNodeId();
  const selectedNodeIds = useFlowStructureStore(state => state.selectedNodeIds);
  
  const selectedNodes = nodes.filter(node => node.selected);
  
  // Track modifier keys for debugging
  const [modifiers, setModifiers] = useState({
    shift: false,
    ctrl: false
  });
  
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Shift') {
        setModifiers(prev => ({ ...prev, shift: true }));
      }
      if (e.key === 'Control' || e.key === 'Meta') {
        setModifiers(prev => ({ ...prev, ctrl: true }));
      }
    };
    
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Shift') {
        setModifiers(prev => ({ ...prev, shift: false }));
      }
      if (e.key === 'Control' || e.key === 'Meta') {
        setModifiers(prev => ({ ...prev, ctrl: false }));
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);
  
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
      <div className="flex items-center space-x-4">
        <span>Nodes: {nodes.length}</span>
        <span>Edges: {edges.length}</span>
      </div>
      <div className="flex items-center space-x-4">
        <span>Selected node: {selectedNodeId || 'none'}</span>
        <span>Selected nodes (Zustand): [{selectedNodeIds.join(', ')}]</span>
        <span>Selected nodes (ReactFlow): {selectedNodes.length} ({selectedNodes.map(n => n.id).join(', ')})</span>
      </div>
      <div className="flex items-center gap-2 ml-2">
        <span className={`${modifiers.shift ? 'text-green-400' : 'text-gray-500'}`}>
          SHIFT {modifiers.shift ? '✓' : '✗'}
        </span>
        <span className={`${modifiers.ctrl ? 'text-green-400' : 'text-gray-500'}`}>
          CTRL/CMD {modifiers.ctrl ? '✓' : '✗'}
        </span>
      </div>
    </div>
  );
}; 