import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  nodeId: string;
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class NodeErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Node Error:', error);
    console.error('Error Info:', errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="p-4 bg-red-50 border-2 border-red-200 rounded-md w-[350px]">
          <div className="text-red-600 font-medium mb-2">Node Error</div>
          <div className="text-sm text-red-500">
            {this.state.error?.message || 'An unexpected error occurred'}
          </div>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            className="mt-2 px-2 py-1 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200"
          >
            Try Again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default NodeErrorBoundary; 