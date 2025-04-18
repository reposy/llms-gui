// src/components/nodes/NodeErrorBoundary.tsx
import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  nodeId: string;
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

/**
 * 노드 내부 에러를 처리하는 에러 바운더리 컴포넌트
 * 노드 내부에서 오류가 발생해도 전체 플로우가 중단되지 않게 함
 */
class NodeErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorInfo: null
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    this.setState({
      error,
      errorInfo
    });
    
    console.error(`[NodeError] Error in node ${this.props.nodeId}:`, error, errorInfo);
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="p-4 rounded border border-red-500 bg-red-50 text-red-800">
          <h3 className="text-lg font-bold">노드 오류 발생</h3>
          <p className="text-sm">ID: {this.props.nodeId}</p>
          <p className="text-sm mt-2">{this.state.error?.message}</p>
        </div>
      );
    }

    return this.props.children;
  }
}

export default NodeErrorBoundary; 