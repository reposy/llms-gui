import { createWithEqualityFn } from 'zustand/traditional';
import { devtools } from 'zustand/middleware';
import { isEqual } from 'lodash';

interface SelectionLock {
  locked: boolean;
  lockExpiry: number | null;
}

interface SelectionStateStore {
  selectedNodeId: string | null;
  selectionLock: SelectionLock;

  // Internal actions - should generally be called via useSelectionManager
  _setSelectedNodeIdInternal: (id: string | null) => void;
  _setSelectionLockInternal: (lock: SelectionLock) => void;
}

export const useSelectionStateStore = createWithEqualityFn<SelectionStateStore>()(
  devtools(
    (set) => ({
      selectedNodeId: null,
      selectionLock: {
        locked: false,
        lockExpiry: null,
      },
      _setSelectedNodeIdInternal: (id) => set({ selectedNodeId: id }),
      _setSelectionLockInternal: (lock) => set({ selectionLock: lock }),
    }),
    { name: 'selection-state-store' }
  ),
  isEqual
);

// Export selectors
export const useCurrentSelectedNodeId = () => useSelectionStateStore(state => state.selectedNodeId);
export const useIsSelectionLockedState = () => useSelectionStateStore(state => {
  const { locked, lockExpiry } = state.selectionLock;
  if (!locked || !lockExpiry || Date.now() > lockExpiry) {
    return false;
  }
  return true;
}); 