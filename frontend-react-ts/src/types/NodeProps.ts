/**
 * Common props for all node components
 */
export interface NodeProps {
  id: string;
  data: Record<string, any>;
  selected?: boolean;
  isConnectable?: boolean;
} 