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
import { HTMLParserNode } from './HTMLParserNode';
import { NodeFactory } from './NodeFactory';

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
 * NodeFactory 인스턴스에 모든 노드 타입을 등록
 */
export function registerAllNodeTypes(factory: NodeFactory) {
  // Register factory functions for node types
  factory.register('input', (id, property, context) => {
    const inputProperty = {
      type: 'input' as const,
      items: Array.isArray(property.items) ? property.items : [],
      iterateEachRow: Boolean(property.iterateEachRow),
      ...property
    };
    if (context) {
      return new InputNode(id, inputProperty, context);
    }
    return new InputNode(id, inputProperty);
  });

  factory.register('llm', (id, property, context) => {
    const llmProperty = {
      type: 'llm' as const,
      prompt: 'prompt' in property ? property.prompt : '',
      temperature: 'temperature' in property ? property.temperature : 0.7,
      model: 'model' in property ? property.model : 'llama3',
      provider: 'provider' in property ? property.provider : 'ollama',
      ollamaUrl: 'ollamaUrl' in property ? property.ollamaUrl : 'http://localhost:11434',
      openaiApiKey: 'openaiApiKey' in property ? property.openaiApiKey : '',
      mode: 'mode' in property ? property.mode : 'text',
      ...property
    };
    if (context) {
      return new LlmNode(id, llmProperty, context);
    }
    return new LlmNode(id, llmProperty);
  });
  
  factory.register('api', (id, property, context) => {
    const apiProperty = {
      type: 'api' as const,
      method: property.method || 'GET',
      url: property.url || '',
      headers: property.headers || {},
      ...property
    };
    if (context) {
      return new ApiNode(id, apiProperty, context);
    }
    return new ApiNode(id, apiProperty);
  });
  
  factory.register('output', (id, property, context) => {
    const outputProperty = {
      type: 'output' as const,
      format: property.format || 'text',
      content: property.content || '',
      ...property
    };
    if (context) {
      return new OutputNode(id, outputProperty, context);
    }
    return new OutputNode(id, outputProperty);
  });

  // Register merger node type
  factory.register('merger', (id, property, context) => {
    const mergerProperty = {
      type: 'merger' as const,
      mergeMode: property.mergeMode || 'concat',
      propertyNames: property.propertyNames || [],
      ...property
    };
    if (context) {
      return new MergerNode(id, mergerProperty, context);
    }
    return new MergerNode(id, mergerProperty);
  });

  // Register HTML Parser node type
  factory.register('html-parser', (id, property, context) => {
    const htmlParserProperty = {
      type: 'html-parser' as const,
      extractionRules: property.extractionRules || [],
      ...property
    };
    if (context) {
      return new HTMLParserNode(id, htmlParserProperty, context);
    }
    return new HTMLParserNode(id, htmlParserProperty);
  });

  // ConditionalNode, GroupNode, JsonExtractorNode, WebCrawlerNode
  // don't need special property handling so we pass property directly
  factory.register('conditional', (id, property, context) => {
    const conditionalProperty = {
      type: 'conditional' as const,
      ...property
    };
    if (context) {
      return new ConditionalNode(id, conditionalProperty, context);
    }
    return new ConditionalNode(id, conditionalProperty);
  });

  factory.register('group', (id, property, context) => {
    const groupProperty = {
      type: 'group' as const,
      ...property
    };
    if (context) {
      return new GroupNode(id, groupProperty, context);
    }
    return new GroupNode(id, groupProperty);
  });

  factory.register('json-extractor', (id, property, context) => {
    const jsonExtractorProperty = {
      type: 'json-extractor' as const,
      ...property
    };
    if (context) {
      return new JsonExtractorNode(id, jsonExtractorProperty, context);
    }
    return new JsonExtractorNode(id, jsonExtractorProperty);
  });

  factory.register('web-crawler', (id, property, context) => {
    const webCrawlerProperty = {
      type: 'web-crawler' as const,
      ...property
    };
    if (context) {
      return new WebCrawlerNode(id, webCrawlerProperty, context);
    }
    return new WebCrawlerNode(id, webCrawlerProperty);
  });
}

/**
 * Get all registered node types
 */
export function getAllNodeTypes(): string[] {
  return Array.from(nodeFactoryMap.keys());
} 