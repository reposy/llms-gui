import { BackendFileMetadata } from '../files';

export type InputType = 'text' | 'file' | 'flow-result' | 'property';

export interface InputRow {
  type: InputType;
  value: string | File | BackendFileMetadata | null;
  sourceFlowId?: string | undefined;
  flowChainId?: string | undefined;
  fileMetadata?: BackendFileMetadata;
} 