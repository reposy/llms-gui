// This file replaces the Redux viewModeSlice with constants for use in Zustand
// It maintains the same interface for compatibility with existing components

// View mode constants
export const VIEW_MODES = {
  EXPANDED: 'expanded' as const,
  COMPACT: 'compact' as const,
  AUTO: 'auto' as const,
};

// Type definitions derived from previous Redux slice
export type NodeViewMode = 'expanded' | 'compact' | 'auto';
export type GlobalViewMode = 'expanded' | 'compact' | 'auto';

// This function is just for type compatibility with existing code
// The actual implementation uses the Zustand store in viewModeStore.ts
export const setNodeViewMode = (params: { nodeId: string; mode: NodeViewMode }) => {
  console.warn('setNodeViewMode from viewModeSlice.ts is deprecated. Use Zustand store directly.');
  return { type: 'DEPRECATED_ACTION', payload: params };
}; 