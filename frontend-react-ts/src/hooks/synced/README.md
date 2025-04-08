# Synced Node Field Hooks

This module provides hooks for synchronizing local component state with Redux store node data. It solves common issues with state initialization, synchronization, and prevents data loss when clicking between nodes.

## Problem Solved

These hooks address the following issues:
- State being initialized with fallback values before Redux data is available
- Data loss when clicking on the same node multiple times
- Duplicated sync logic across different node components
- Unnecessary re-renders when store data hasn't actually changed
- Initialization being skipped when switching between nodes then back
- State resets caused by React's useState hook recreation during re-renders

## Recent Improvements

The hooks now include additional safeguards to prevent data loss:

- Tracking of previous `nodeId` to detect node changes and reset initialization state
- Enhanced logging to debug initialization and data flow issues
- Better handling of undefined Redux store data during initialization
- Node-specific initialization that properly resets when switching nodes
- Null safety checks throughout to handle transient states
- **New:** Persistent state hooks using Map-based caching to prevent re-initialization on re-renders
- **New:** NodeId-keyed state hooks to isolate state between different nodes
- **New:** Automatic cleanup of old state hooks to prevent memory leaks

## Implementation Details

### Key Changes to Fix State Reset Issues

1. **State Hook Stability**
   - Previous issue: State hooks were recreated on each render, losing their values when a component re-rendered
   - Solution: State hooks are now cached in a Map with node-specific keys

2. **Node-Aware State Management**
   - Previous issue: State was shared across nodes or reset when nodes changed
   - Solution: Each state hook is now keyed by both nodeId and field name, isolating state per node

3. **Cleanup on Node Changes**
   - Previous issue: Stale state hooks remained in memory and could cause inconsistencies
   - Solution: When nodeId changes, old state hooks are removed from the Map

## Available Hooks

### `useSyncedNodeField`

Synchronizes a single field between Redux store and local state.

```tsx
// Basic usage
const [textBuffer, setTextBuffer] = useSyncedNodeField<string>({
  nodeId,
  field: 'textBuffer',
  defaultValue: ''
});

// With automatic dispatch to Redux
const [textBuffer, setTextBuffer] = useSyncedNodeField<string>({
  nodeId,
  field: 'textBuffer',
  defaultValue: '',
  dispatchOnChange: true
});

// With custom comparison function
const [items, setItems] = useSyncedNodeField<Item[]>({
  nodeId, 
  field: 'items',
  defaultValue: [],
  compare: (a, b) => JSON.stringify(a) === JSON.stringify(b)
});

// Using the manual sync function
const [items, setItems, syncItemsToStore] = useSyncedNodeField<Item[]>({
  nodeId,
  field: 'items',
  defaultValue: []
});

// Update local state
setItems(newItems);

// Then later sync to store when ready
syncItemsToStore();
```

### `useSyncedNodeFields`

Synchronizes multiple fields at once between Redux store and local state.

```tsx
// Basic usage
const { values, setValues } = useSyncedNodeFields({
  nodeId,
  fields: {
    items: [],
    textBuffer: '',
    iterateEachRow: false
  }
});

// Access values
const { items, textBuffer, iterateEachRow } = values;

// Update multiple values at once
setValues({
  items: newItems,
  textBuffer: newText
});

// With automatic dispatch to Redux
const { values, setValues } = useSyncedNodeFields({
  nodeId,
  fields: {
    items: [],
    textBuffer: '',
    iterateEachRow: false
  },
  dispatchOnChange: true
});

// With custom comparison functions
const { values, setValues, syncToStore } = useSyncedNodeFields({
  nodeId,
  fields: {
    items: [],
    textBuffer: '',
    iterateEachRow: false
  },
  compareMap: {
    items: (a, b) => JSON.stringify(a) === JSON.stringify(b)
  }
});

// Manual sync to store
syncToStore();

// Sync specific updates
syncToStore({ items: values.items });
```

## Example: Refactoring `useInputNodeData`

Before:
```tsx
// Old approach with manual sync logic
const [items, setItems] = useState<Item[]>([]);
const [textBuffer, setTextBuffer] = useState('');
const isInitializedRef = useRef(false);

useEffect(() => {
  if (nodeDataFromStore && !isInitializedRef.current) {
    setItems(nodeDataFromStore.items || []);
    setTextBuffer(nodeDataFromStore.textBuffer || '');
    isInitializedRef.current = true;
  }
}, [nodeDataFromStore]);

useEffect(() => {
  if (!isInitializedRef.current) return;
  // Sync logic...
}, [nodeDataFromStore.items]);
```

After:
```tsx
// Clean approach with synced hooks
const [items, setItems] = useSyncedNodeField<Item[]>({
  nodeId,
  field: 'items',
  defaultValue: []
});

const [textBuffer, setTextBuffer] = useSyncedNodeField<string>({
  nodeId,
  field: 'textBuffer',
  defaultValue: ''
});

// Or with multiple fields
const { values, setValues } = useSyncedNodeFields({
  nodeId,
  fields: {
    items: [],
    textBuffer: '',
    iterateEachRow: false
  }
});
```

## Best Practices

When using these hooks in components:

1. **Always include null safety checks** when working with values:
   ```tsx
   if (!items || items.length === 0) return [];
   ```

2. **Track node changes** to reset UI state that's not managed by the hooks:
   ```tsx
   const prevNodeIdRef = useRef<string | null>(null);
   
   useEffect(() => {
     if (prevNodeIdRef.current !== nodeId) {
       setLocalState(null);
       prevNodeIdRef.current = nodeId;
     }
   }, [nodeId]);
   ```

3. **Use defensive copying** when modifying arrays/objects:
   ```tsx
   const currentItems = items ? [...items] : [];
   ```

4. **Check for undefined** before accessing store data:
   ```tsx
   if (!latestNode) {
     console.warn(`Node ${nodeId} not found in store, skipping update`);
     return;
   }
   ```

5. **Monitor initialization** via console logs for debugging:
   ```tsx
   console.log(`[Hook] Initial load for ${nodeId}.${field}`, storeValue);
   ```

6. **Avoid direct state-setting during rendering** - always use effects or callbacks:
   ```tsx
   // Avoid
   if (condition) setState(newValue); // during render
   
   // Prefer
   useEffect(() => {
     if (condition) setState(newValue);
   }, [condition]);
   ``` 