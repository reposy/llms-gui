/**
 * Context for flow execution
 * Provides utilities and state management during flow execution
 */
export class FlowExecutionContext {
  /**
   * Unique execution ID
   */
  executionId: string;

  /**
   * Constructor
   * @param executionId Unique identifier for this execution
   */
  constructor(executionId: string) {
    this.executionId = executionId;
  }

  /**
   * Log a message with the execution context
   * @param message Message to log
   */
  log(message: string) {
    console.log(`[Flow ${this.executionId}] ${message}`);
  }
} 