import { Node } from '../core/Node';
import { FlowExecutionContext } from './FlowExecutionContext';
import { getNodeContent } from '../store/useNodeContentStore';
import { APINodeContent } from '../store/useNodeContentStore';

interface ApiNodeProperty {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  url: string;
  headers: Record<string, string>;
  // Reference to flow structure (will be provided by FlowRunner)
  nodes?: any[];
  edges?: any[];
}

export class ApiNode extends Node {
  declare property: ApiNodeProperty;

  /**
   * Constructor for ApiNode
   */
  constructor(
    id: string, 
    property: ApiNodeProperty, 
    context?: FlowExecutionContext
  ) {
    super(id, 'api', property, context);
  }

  /**
   * Synchronize property from Zustand store before execution
   */
  syncPropertyFromStore(): void {
    const content = getNodeContent(this.id) as APINodeContent;
    if (content) {
      if (typeof content.url === 'string') this.property.url = content.url;
      if (typeof content.method === 'string') this.property.method = content.method as ApiNodeProperty['method'];
      if (typeof content.headers === 'object' && content.headers !== null) this.property.headers = { ...content.headers };
      if (content.nodes) this.property.nodes = content.nodes;
      if (content.edges) this.property.edges = content.edges;
    }
  }

  async execute(input: any): Promise<any> {
    this.context?.log(`ApiNode(${this.id}): Calling ${this.property.method} ${this.property.url}`);

    try {
      const response = await fetch(this.property.url, {
        method: this.property.method,
        headers: this.property.headers,
        body: this.property.method !== 'GET' ? JSON.stringify(input) : undefined
      });

      const contentType = response.headers.get('content-type');
      const result = contentType?.includes('application/json')
        ? await response.json()
        : await response.text();

      this.context?.log(`ApiNode(${this.id}): Received response`);
      return result;
    } catch (error) {
      this.context?.log(`ApiNode(${this.id}): Error - ${error}`);
      throw error;
    }
  }

  // Remove custom getChildNodes() method and use the base class implementation
  // which will dynamically resolve children based on current edges
} 