import { LlmNode } from './LlmNode';
import { InputNode } from './InputNode';
import { ApiNode } from './ApiNode';
import { OutputNode } from './OutputNode';
import { ConditionalNode } from './ConditionalNode';
import { GroupNode } from './GroupNode';
import { JsonExtractorNode } from './JsonExtractorNode';
import { FlowExecutionContext } from './FlowExecutionContext';
import { WebCrawlerNode } from './WebCrawlerNode';
import { MergerNode } from './MergerNode';

// Factory function that creates node objects based on type
type NodeFactoryFn = (id: string, property: Record<string, any>, context?: FlowExecutionContext) => any;

// Map of node types to factory functions
const nodeFactoryMap = new Map<string, NodeFactoryFn>();

/**
 * Register a node type with its factory function
 */
export function registerNodeType(type: string, factory: NodeFactoryFn) {
  nodeFactoryMap.set(type, factory);
}

/**
 * Get factory function for a node type
 */
export function getNodeFactory(type: string): NodeFactoryFn | undefined {
  return nodeFactoryMap.get(type);
}

/**
 * Register all default node types
 */
export function registerAllNodeTypes() {
  // Register factory functions for node types
  registerNodeType('input', (id, property, context) => {
    // Ensure required input node properties exist with defaults
    const inputProperty = {
      items: Array.isArray(property.items) ? property.items : [],
      iterateEachRow: Boolean(property.iterateEachRow),
      ...property
    };
    return new InputNode(id, inputProperty, context);
  });

  registerNodeType('llm', (id, property, context) => {
    // Ensure required LLM node properties exist with defaults
    const llmProperty = {
      // Set required defaults
      prompt: 'prompt' in property ? property.prompt : '',
      temperature: 'temperature' in property ? property.temperature : 0.7,
      model: 'model' in property ? property.model : 'llama3',
      provider: 'provider' in property ? property.provider : 'ollama',
      ollamaUrl: 'ollamaUrl' in property ? property.ollamaUrl : 'http://localhost:11434',
      openaiApiKey: 'openaiApiKey' in property ? property.openaiApiKey : '',
      mode: 'mode' in property ? property.mode : 'text',
      // Preserve any other properties
      ...property
    };
    return new LlmNode(id, llmProperty, context);
  });
  
  registerNodeType('api', (id, property, context) => {
    // Ensure required API node properties exist with defaults
    const apiProperty = {
      method: property.method || 'GET',
      url: property.url || '',
      headers: property.headers || {},
      ...property
    };
    return new ApiNode(id, apiProperty, context);
  });
  
  registerNodeType('output', (id, property, context) => {
    // Ensure required output node properties exist with defaults
    const outputProperty = {
      format: property.format || 'text',
      data: property.data || null,
      ...property
    };
    return new OutputNode(id, outputProperty, context);
  });

  // Register merger node type
  registerNodeType('merger', (id, property, context) => {
    // Ensure required merger node properties exist with defaults
    const mergerProperty = {
      strategy: property.strategy || 'array',
      keys: property.keys || [],
      ...property
    };
    return new MergerNode(id, mergerProperty, context);
  });

  // ConditionalNode, GroupNode, JsonExtractorNode, WebCrawlerNode
  // don't need special property handling so we pass property directly
  registerNodeType('conditional', (id, property, context) => {
    return new ConditionalNode(id, property, context);
  });

  registerNodeType('group', (id, property, context) => {
    return new GroupNode(id, property, context);
  });

  registerNodeType('json-extractor', (id, property, context) => {
    return new JsonExtractorNode(id, property, context);
  });

  registerNodeType('web-crawler', (id, property, context) => {
    return new WebCrawlerNode(id, property, context);
  });
}

/**
 * Get all registered node types
 */
export function getAllNodeTypes(): string[] {
  return Array.from(nodeFactoryMap.keys());
} 