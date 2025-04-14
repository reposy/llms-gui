import { Node } from '../core/Node';

interface GroupNodeProperty {
  label: string;
  // Reference to flow structure (will be provided by FlowRunner)
  nodes?: any[];
  edges?: any[];
  nodeFactory?: any;
}

export class GroupNode extends Node {
  declare property: GroupNodeProperty;

  async process(input: any): Promise<any> {
    this.context.log(`GroupNode(${this.id}): Processing group with label "${this.property.label}"`);
    
    // The group node simply passes input through to its children
    // The actual child node execution is handled by the base Node.execute() method
    return input;
  }

  // Remove custom getChildNodes implementation
  // The base class implementation will use edges to determine child nodes
  // Special group parent-child relationships are now determined by the execution graph
} 