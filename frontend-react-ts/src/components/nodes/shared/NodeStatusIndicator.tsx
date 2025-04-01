import React from 'react';

interface Props {
  status: 'idle' | 'running' | 'success' | 'error';
  error?: string | undefined;
  loadingText?: string;
  successText?: string;
  errorText?: string;
}

export const NodeStatusIndicator: React.FC<Props> = React.memo(({ 
  status, 
  error,
  loadingText = 'Running...',
  successText = 'Success',
  errorText = 'Error'
}) => {
  if (status === 'idle') {
    return null; // Don't show anything when idle
  }

  return (
    <div className="flex items-center gap-1 text-xs py-1">
      {status === 'running' && (
        <span className="text-yellow-600">⏳ {loadingText}</span>
      )}
      {status === 'success' && (
        <span className="text-green-600">✅ {successText}</span>
      )}
      {status === 'error' && (
        <span className="text-red-600" title={error ?? undefined}>❌ {errorText}</span>
      )}
    </div>
  );
});

NodeStatusIndicator.displayName = 'NodeStatusIndicator'; 