import { Node } from '../core/Node';
import { getOutgoingConnections } from '../utils/flowUtils';

interface ApiNodeProperty {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  url: string;
  headers: Record<string, string>;
  // Reference to flow structure (will be provided by FlowRunner)
  nodes?: any[];
  edges?: any[];
}

export class ApiNode extends Node {
  declare property: ApiNodeProperty;

  async process(input: any): Promise<any> {
    this.context.log(`ApiNode(${this.id}): Calling ${this.property.method} ${this.property.url}`);

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

      this.context.log(`ApiNode(${this.id}): Received response`);
      return result;
    } catch (error) {
      this.context.log(`ApiNode(${this.id}): Error - ${error}`);
      throw error;
    }
  }

  // Remove custom getChildNodes() method and use the base class implementation
  // which will dynamically resolve children based on current edges
} 