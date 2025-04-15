# Node Workflow System Refactoring Guide

## Main Changes

We've refactored the node execution pattern to establish a clear and consistent execution flow across all node types. The primary goals were:

1. Standardize the relationship between `process()` and `execute()` methods
2. Create a consistent pattern for node execution flow
3. Improve code reusability and maintainability
4. Simplify the implementation of new node types

## Node Execution Pattern

### Base Node Class

The `Node` base class now implements a standardized execution pattern:

1. `process()` is the **main entry point** for all node execution
   - Handles setup (marking node as running, cloning input)
   - Calls `execute()` to perform node-specific logic
   - Stores the output in the execution context
   - Marks the node as successful
   - Propagates the result to child nodes

2. `execute()` is an **abstract method** that each node type must implement
   - Handles the node-specific business logic
   - Returns the processed result
   - Does NOT handle child node propagation (that's done by `process()`)

### Implementation Guidelines

When implementing a new node type:

1. **Only implement `execute()`** - you don't need to override `process()` unless you have a very specific reason
2. Your `execute()` method should focus on the node's core logic without worrying about:
   - Marking node status (running/success/error)
   - Propagating to child nodes
   - Storing output in the context (though you can if needed for UI updates)

3. Return the processed result from `execute()` and the base `process()` method will handle the rest

## Example Implementation

```typescript
export class YourCustomNode extends Node {
  // Type assertion for property (optional but recommended)
  declare property: YourCustomNodeProperty;
  
  // Implement the execute method for your node's specific logic
  async execute(input: any): Promise<any> {
    // Log what's happening
    this.context.log(`YourCustomNode(${this.id}): Processing input`);
    
    // Do your node-specific processing here
    const result = await doSomethingWith(input);
    
    // Return the result (don't worry about child nodes)
    return result;
  }
}
```

## Child Node Selection

By default, the base `Node.getChildNodes()` method handles finding and creating the appropriate child nodes based on your flow's edges.

If your node needs special logic for selecting which child nodes to execute (like a conditional node), you can override the `getChildNodes()` method:

```typescript
getChildNodes(): Node[] {
  // Your custom logic to determine which child nodes to execute
  // For example, a conditional node might only execute the 'true' or 'false' path
  const result = this.context.getOutput(this.id);
  
  // Do custom selection logic
  // ...
  
  return selectedNodes;
}
```