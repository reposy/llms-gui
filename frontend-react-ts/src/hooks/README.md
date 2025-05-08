# Node Data Hooks

This directory contains React hooks for managing node data in the llms-gui application. All hooks follow a standardized pattern for consistency and maintainability.

## Hook Factory Pattern

The hooks in this directory use a factory pattern to standardize the implementation. This eliminates code duplication, ensures consistent behavior, and makes maintenance easier.

### How It Works

1. The `useNodeDataFactory.ts` exports a generic factory function `createNodeDataHook` that produces standardized hooks
2. Each specific node type hook (e.g., `useLlmNodeData`, `useApiNodeData`, etc.) uses the factory function with its own type
3. Default values are defined in each hook and type casting is handled consistently

### Benefits

- Removes duplicate code for content fetching, updating, and deep equality checking
- Standardizes property access patterns and default values
- Provides consistent change handlers with the same behavior
- Makes adding new node types easier by reusing the same pattern
- Helps identify and fix type issues across the application

## Standard Hook Interface

Each hook returns:

- `content`: The full content object fetched from the store
- Individual properties extracted from content with defaults
- Change handlers for updating specific properties
- `updateContent`: A method to update multiple properties at once
- Additional functionality specific to the node type

## Example Usage

Here's how to use these hooks in components:

```tsx
// In a node component
function MyNodeComponent({ id }) {
  const {
    content,
    someProperty,
    anotherProperty,
    handleSomePropertyChange,
    updateContent
  } = useMyNodeData({ nodeId: id });

  // Use properties and handlers in your component
  return (
    <div>
      <input 
        value={someProperty} 
        onChange={(e) => handleSomePropertyChange(e.target.value)} 
      />
      <button 
        onClick={() => updateContent({ 
          someProperty: 'new value',
          anotherProperty: 123 
        })}
      >
        Update Multiple
      </button>
    </div>
  );
}
```

## Adding a New Node Hook

To add a hook for a new node type:

1. Define your node content type in `src/types/nodes.ts`
2. Create a hook file with default values for your node type
3. Use the `createNodeDataHook` factory to implement your hook
4. Export any specific functionality needed for your node type

Example:

```ts
import { createNodeDataHook } from './useNodeDataFactory';
import { YourNodeContent } from '../types/nodes';

/**
 * Default values for your node content
 */
const YOUR_NODE_DEFAULTS: Partial<YourNodeContent> = {
  property1: 'default value',
  property2: 123
};

/**
 * Custom hook to manage your node state and operations
 */
export const useYourNodeData = ({ nodeId }: { nodeId: string }) => {
  // Use the factory to create the base hook functionality
  const { 
    content, 
    updateContent, 
    createChangeHandler 
  } = createNodeDataHook<YourNodeContent>('your-node-type', YOUR_NODE_DEFAULTS)({ nodeId });

  // Extract properties with defaults
  const property1 = content?.property1 || YOUR_NODE_DEFAULTS.property1;
  const property2 = content?.property2 || YOUR_NODE_DEFAULTS.property2;

  // Create standard change handlers
  const handleProperty1Change = createChangeHandler('property1');
  const handleProperty2Change = createChangeHandler('property2');

  // Any additional node-specific logic
  const someSpecialFunction = () => {
    // Do something specific to this node
  };

  return {
    content,
    property1,
    property2,
    handleProperty1Change,
    handleProperty2Change,
    someSpecialFunction,
    updateContent
  };
}; 