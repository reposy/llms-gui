import React, { useCallback, useMemo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { NodeProps } from '../../types/nodes';
import { PhotoIcon, XCircleIcon, ExclamationTriangleIcon, TrashIcon } from '@heroicons/react/24/outline';
import { useInputNodeData } from '../../hooks/useInputNodeData';
import { BackendFileMetadata } from '../../types/files';
import { formatItemsForDisplay } from '../../utils/ui/formatInputItems';
import { runSingleNodeExecution } from '../../hooks/useFlowExecutor';
import clsx from 'clsx';
import { NodeErrorBoundary } from '../nodes/NodeErrorBoundary';

const InputNode: React.FC<{ id: string }> = ({ id }) => {
  // useInputNodeData 훅 사용 (통합 파일 시스템)
  const {
    chainingItems,
    commonItems,
    items,
    textBuffer,
    iterateEachRow,
    chainingUpdateMode,
    handleAddText,
    handleFileChange,
    handleDeleteItem,
    updateInputContent,
    handleClearItems,
    fileUploading,
    uploadError,
    uploadProgress,
    clearUploadError,
    serverConnected
  } = useInputNodeData({ nodeId: id });

  return (
    <div className="flex flex-col h-full">
      {/* File Input Area - 통합 파일 시스템 사용 */} 
      <div className="px-4 py-2 border-t border-gray-200">
        <div className="flex justify-between items-center mb-2">
          <label className="block text-xs font-medium text-gray-500">
            파일 업로드 (이미지만, 최대 10MB):
          </label>
          <div className="flex space-x-1">
            <input
              type="file"
              id={`common-file-input-${id}`}
              onChange={(e) => handleFileChange(e, 'common')}
              className="hidden"
              accept="image/*"
              multiple
              disabled={fileUploading}
            />
            <input
              type="file"
              id={`element-file-input-${id}`}
              onChange={(e) => handleFileChange(e, 'element')}
              className="hidden"
              accept="image/*"
              multiple
              disabled={fileUploading}
            />
            <label
              htmlFor={`common-file-input-${id}`}
              className={`cursor-pointer px-2 py-1 text-xs font-medium rounded flex items-center transition-colors ${
                fileUploading 
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed' 
                  : 'bg-purple-100 text-purple-800 hover:bg-purple-200'
              }`}
            >
              <PhotoIcon className="h-3 w-3 mr-1" />
              {fileUploading ? '업로드중...' : 'Common'}
            </label>
            <label
              htmlFor={`element-file-input-${id}`}
              className={`cursor-pointer px-2 py-1 text-xs font-medium rounded flex items-center transition-colors ${
                fileUploading 
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed' 
                  : 'bg-orange-100 text-orange-800 hover:bg-orange-200'
              }`}
            >
              <PhotoIcon className="h-3 w-3 mr-1" />
              {fileUploading ? '업로드중...' : 'Element'}
            </label>
          </div>
        </div>
        
        {/* 백엔드 파일 시스템 상태 표시 */}
        <div className="mt-2 p-2 bg-green-50 border border-green-200 rounded-md">
          <div className="flex items-start">
            <div className="h-4 w-4 text-green-500 mr-1">✅</div>
            <p className="text-xs text-green-700 flex-grow">
              백엔드 파일 시스템 연결됨 - 새로고침 시에도 파일이 유지됩니다
            </p>
          </div>
        </div>
        
        {/* 업로드 진행률 */}
        {fileUploading && uploadProgress > 0 && (
          <div className="mt-2">
            <div className="flex items-center justify-between text-xs text-gray-600 mb-1">
              <span>백엔드에 업로드 중...</span>
              <span>{uploadProgress}%</span>
            </div>
            <div className="w-full h-2 bg-gray-200 rounded">
              <div 
                className="h-full bg-blue-500 rounded transition-all duration-300"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
          </div>
        )}
        
        {/* 업로드 에러 */}
        {uploadError && (
          <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded-md">
            <div className="flex items-start justify-between">
              <p className="text-xs text-red-600 flex-grow">❌ {uploadError}</p>
              <button 
                onClick={clearUploadError}
                className="text-red-400 hover:text-red-600 ml-2"
              >
                <XCircleIcon className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default InputNode; 