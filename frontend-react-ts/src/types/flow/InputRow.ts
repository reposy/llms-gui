export type InputType = 'text' | 'file' | 'flow-result' | 'property';

export interface InputRow {
  type: InputType;
  value: string | File | null;
  sourceFlowId?: string | undefined;
  flowChainId?: string | undefined;
} 