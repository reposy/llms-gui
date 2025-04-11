import { NodeFactory } from './NodeFactory';
import { ApiNode } from '../nodes/ApiNode';
import { MergerNode } from '../nodes/MergerNode';
import { GroupNode } from '../nodes/GroupNode';
import { InputNode } from '../nodes/InputNode';
import { OutputNode } from '../nodes/OutputNode';
import { LlmNode } from '../nodes/LlmNode';
import { ConditionalNode } from '../nodes/ConditionalNode';

/**
 * Register all node types with the factory
 * To be implemented in Phase 2+
 * 
 * @param factory The node factory to register with
 */
export function registerAllNodeTypes(factory: NodeFactory): void {
  factory.register('input', (id, property, context) => new InputNode(id, property, context));
  factory.register('output', (id, property, context) => new OutputNode(id, property, context));
  factory.register('llm', (id, property, context) => new LlmNode(id, property, context));
  factory.register('conditional', (id, property, context) => new ConditionalNode(id, property, context));
  factory.register('api', (id, property, context) => new ApiNode(id, property, context));
  factory.register('merger', (id, property, context) => new MergerNode(id, property, context));
  factory.register('group', (id, property, context) => new GroupNode(id, property, context));
}