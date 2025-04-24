import React, { useState, useCallback, useMemo } from 'react';
import { Node } from '@xyflow/react';
import { MergerNodeData } from '../../types/nodes';
import { useMergerNodeData } from '../../hooks/useMergerNodeData';
import { ClipboardDocumentIcon, CheckIcon } from '@heroicons/react/24/solid';
import clsx from 'clsx';

interface MergerConfigProps {
  selectedNode: Node<MergerNodeData>;
}

export const MergerConfig: React.FC<MergerConfigProps> = ({ selectedNode }) => {
  const { id } = selectedNode;
  const { items, itemCount, resetItems } = useMergerNodeData({ nodeId: id });

  const [selectedPreviewIndex, setSelectedPreviewIndex] = useState<number | null>(null);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const handleResetClick = useCallback(() => {
    resetItems();
    setSelectedPreviewIndex(null);
    setCopiedIndex(null);
  }, [resetItems]);

  const handleCopyItem = useCallback((item: any, index: number) => {
    const textToCopy = typeof item === 'string' ? item : JSON.stringify(item, null, 2);
    navigator.clipboard.writeText(textToCopy)
      .then(() => {
        setCopiedIndex(index);
        setTimeout(() => setCopiedIndex(null), 1500);
      })
      .catch(err => {
        console.error('Failed to copy text: ', err);
        // Optionally add error feedback
      });
  }, []);

  const selectedItemPreview = useMemo(() => {
    if (selectedPreviewIndex !== null && items && items[selectedPreviewIndex] !== undefined) {
      const item = items[selectedPreviewIndex];
      return typeof item === 'string' ? item : JSON.stringify(item, null, 2);
    }
    return null;
  }, [selectedPreviewIndex, items]);

  return (
    <div className="p-4 space-y-4">
      <div>
        <div className="flex justify-between items-center mb-1">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Accumulated Items ({itemCount})
          </label>
          <button
            onClick={handleResetClick}
            className="px-2.5 py-1 text-xs rounded bg-slate-200 dark:bg-slate-600 text-slate-700 dark:text-slate-200 hover:bg-slate-300 dark:hover:bg-slate-500 disabled:opacity-50"
            disabled={itemCount === 0}
          >
            Reset Items
          </button>
        </div>

        {/* Preview Area */}
        {selectedItemPreview && (
          <div className="mb-3 p-2 border rounded-md bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-600">
            <h4 className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Preview (Item {selectedPreviewIndex !== null ? selectedPreviewIndex + 1 : ''}):</h4>
            <pre className="text-xs text-slate-700 dark:text-slate-200 whitespace-pre-wrap break-all max-h-40 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-300 dark:scrollbar-thumb-slate-600 scrollbar-track-transparent">
              {selectedItemPreview}
            </pre>
          </div>
        )}

        {/* Items List */}
        {items && items.length > 0 ? (
          <div className="w-full max-h-60 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-300 dark:scrollbar-thumb-slate-600 scrollbar-track-transparent border rounded-md border-slate-200 dark:border-slate-600 divide-y divide-slate-200 dark:divide-slate-600">
            {items.map((item: any, index: number) => (
              <div
                key={index}
                onClick={() => setSelectedPreviewIndex(index)}
                className={clsx(
                  "flex items-center justify-between p-2 text-xs cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-600/50",
                  selectedPreviewIndex === index ? "bg-primary-50 dark:bg-primary-800/30" : "bg-white dark:bg-slate-700/50"
                )}
              >
                <span className="flex-shrink-0 w-6 text-center text-slate-400 dark:text-slate-500 mr-2">{index + 1}:</span>
                <span
                  className="flex-grow truncate text-slate-600 dark:text-slate-300"
                  title={typeof item === 'string' ? item : JSON.stringify(item)}
                >
                  {typeof item === 'string'
                    ? (item.length > 45 ? `${item.substring(0, 45)}...` : item || '""')
                    : (JSON.stringify(item).length > 45
                        ? `${JSON.stringify(item).substring(0, 45)}...`
                        : JSON.stringify(item))
                  }
                </span>
                <button
                  onClick={(e) => { e.stopPropagation(); handleCopyItem(item, index); }}
                  title="Copy item content"
                  className={clsx(
                    "ml-2 flex-shrink-0 p-1 rounded text-slate-400 dark:text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-600 hover:text-slate-600 dark:hover:text-slate-300 transition-colors",
                    copiedIndex === index && "text-green-500 dark:text-green-400"
                  )}
                  disabled={copiedIndex === index}
                >
                  {copiedIndex === index ? (
                    <CheckIcon className="w-4 h-4 text-green-500 dark:text-green-400" />
                  ) : (
                    <ClipboardDocumentIcon className="w-4 h-4" />
                  )}
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center text-sm text-slate-400 dark:text-slate-500 py-6">
            No items accumulated yet.
          </div>
        )}
      </div>
      {/* TODO: Add other Merger node configurations here if any (e.g., Output Format, Separator) */}
    </div>
  );
};

export default MergerConfig; 