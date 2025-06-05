import React, { useRef, useState } from 'react';
import type { InputRow, InputType } from '../../../types/flow/InputRow';
import { useUnifiedFileUpload } from '../../../hooks/useUnifiedFileUpload';
import { FILE_CONTEXTS, BackendFileMetadata } from '../../../types/files';

interface InputDataSectionProps {
  inputs: InputRow[];
  onInputsChange: (inputs: InputRow[]) => void;
  editMode: boolean;
  flowId: string;
  focusedFlowChainId?: string;
  flowChainIds: string[];
  flowChainMap: Record<string, any>;
}

const InputDataSection: React.FC<InputDataSectionProps> = ({
  inputs,
  onInputsChange,
  editMode,
  flowId,
  focusedFlowChainId,
  flowChainIds,
  flowChainMap
}) => {
  const fileInputRefs = useRef<(HTMLInputElement | null)[]>([]);
  
  // 통합 파일 업로드 훅 사용
  const { 
    uploading, 
    error: uploadError, 
    progress, 
    uploadedFiles,
    handleFileChange: unifiedFileChange,
    clearError 
  } = useUnifiedFileUpload(FILE_CONTEXTS.FLOW_EXECUTOR);

  // SVG 아이콘들
  const TrashIcon = (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
  const UpIcon = (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 15l7-7 7 7" />
    </svg>
  );
  const DownIcon = (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
    </svg>
  );

  const addInput = (row?: InputRow) => {
    if (!editMode) return;
    onInputsChange([...inputs, row || { type: 'text', value: '' }]);
  };

  const removeInput = (idx: number) => {
    if (!editMode || inputs.length === 1) return;
    onInputsChange(inputs.filter((_, i) => i !== idx));
  };

  const moveInput = (idx: number, dir: 'up' | 'down') => {
    if (!editMode) return;
    const newInputs = [...inputs];
    if (dir === 'up' && idx > 0) {
      [newInputs[idx - 1], newInputs[idx]] = [newInputs[idx], newInputs[idx - 1]];
    } else if (dir === 'down' && idx < newInputs.length - 1) {
      [newInputs[idx], newInputs[idx + 1]] = [newInputs[idx + 1], newInputs[idx]];
    }
    onInputsChange(newInputs);
  };

  const setInputType = (idx: number, type: InputType) => {
    if (!editMode) return;
    const newInputs = [...inputs];
    if (type === 'file') newInputs[idx] = { type, value: null };
    else if (type === 'flow-result') newInputs[idx] = {
      type,
      value: flowId,
      flowChainId: focusedFlowChainId || undefined,
      sourceFlowId: flowId
    };
    else newInputs[idx] = { type, value: '' };
    onInputsChange(newInputs);
  };

  const handleFileChange = async (idx: number, files: FileList | null) => {
    if (!files || !editMode) return;
    
    console.log(`Flow Executor - File selection at index ${idx}:`, Array.from(files).map(f => f.name));
    
    try {
      // 통합 파일 업로드 사용
      const result = await unifiedFileChange({
        target: { files, value: '' }
      } as React.ChangeEvent<HTMLInputElement>);

      if (result.success && result.files.length > 0) {
        const newInputs = [...inputs];
        
        // 업로드된 파일들을 BackendFileMetadata로 처리
        result.files.forEach((fileMetadata: BackendFileMetadata, fileIndex) => {
          console.log(`Flow Executor - Processing uploaded file ${fileIndex}:`, {
            fileId: fileMetadata.fileId,
            originalFileName: fileMetadata.originalFileName,
            filePath: fileMetadata.filePath,
            url: fileMetadata.url,
            backendPath: fileMetadata.backendPath
          });
          
          if (fileIndex === 0) {
            // 첫 번째 파일은 현재 행에 설정
            newInputs[idx] = { 
              type: 'file', 
              value: fileMetadata,  // BackendFileMetadata 저장
              fileMetadata: fileMetadata
            };
          } else {
            // 나머지 파일들은 새 행으로 추가
            newInputs.push({ 
              type: 'file', 
              value: fileMetadata,
              fileMetadata: fileMetadata
            });
          }
        });
        
        onInputsChange(newInputs);
        console.log(`Flow Executor - Updated inputs:`, newInputs);
        console.log(`Flow Executor - Successfully uploaded ${result.files.length} files`);
      } else {
        console.error('Flow Executor - File upload failed:', result.error);
      }
    } catch (error) {
      console.error('Flow Executor - File upload error:', error);
    }
  };

  const handleTextChange = (idx: number, value: string) => {
    if (!editMode) return;
    const newInputs = [...inputs];
    newInputs[idx] = { ...newInputs[idx], value };
    onInputsChange(newInputs);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && e.shiftKey) {
      e.preventDefault();
      addInput();
    }
  };

  const handleDrop = (idx: number, e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const files = Array.from(e.dataTransfer.files);
      const newInputs = [...inputs];
      files.forEach((file, i) => {
        if (i === 0) newInputs[idx] = { type: 'file', value: file };
        else newInputs.push({ type: 'file', value: file });
      });
      onInputsChange(newInputs);
    }
  };

  // 파일 이름 표시 함수
  const getFileDisplayName = (value: any): string => {
    if (!value) return '';
    
    if (value instanceof File) {
      return value.name;
    } else if (typeof value === 'object' && 'originalFileName' in value) {
      // BackendFileMetadata
      return value.originalFileName;
    }
    
    return '';
  };

  // 파일 상태 표시 함수
  const getFileStatus = (value: any): string => {
    if (!value) return '';
    
    if (value instanceof File) {
      return '로컬 파일';
    } else if (typeof value === 'object' && 'fileId' in value) {
      return '백엔드 저장완료';
    }
    
    return '';
  };

  return (
    <div className="mb-6 p-4 border border-gray-200 rounded-lg bg-white">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-md font-medium text-gray-800">Input Data</h3>
        {editMode && (
          <div className="flex gap-2">
            <button 
              type="button" 
              onClick={() => addInput()} 
              className="px-3 py-1 bg-blue-500 text-white rounded text-sm hover:bg-blue-600 transition-colors"
            >
              + Text
            </button>
            <button 
              type="button" 
              onClick={() => addInput({ type: 'file', value: null })} 
              className="px-3 py-1 bg-green-500 text-white rounded text-sm hover:bg-green-600 transition-colors"
            >
              + File
            </button>
            <button 
              type="button" 
              onClick={() => addInput({ 
                type: 'flow-result', 
                value: flowId, 
                flowChainId: focusedFlowChainId || undefined, 
                sourceFlowId: flowId 
              })} 
              className="px-3 py-1 bg-purple-500 text-white rounded text-sm hover:bg-purple-600 transition-colors"
            >
              + Flow Result
            </button>
          </div>
        )}
      </div>
      
      {/* 업로드 상태 표시 */}
      {uploading && (
        <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-blue-700">파일 업로드 중...</span>
            <span className="text-sm text-blue-700">{progress}%</span>
          </div>
          <div className="w-full bg-blue-200 rounded-full h-2">
            <div 
              className="bg-blue-600 h-2 rounded-full transition-all duration-300" 
              style={{ width: `${progress}%` }}
            ></div>
          </div>
        </div>
      )}
      
      {/* 업로드 에러 표시 */}
      {uploadError && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded">
          <div className="flex items-center justify-between">
            <span className="text-sm text-red-700">{uploadError}</span>
            <button 
              onClick={clearError}
              className="text-red-500 hover:text-red-700"
            >
              ✕
            </button>
          </div>
        </div>
      )}
      
      <div className="text-gray-500 text-sm mb-4">
        배치 모드에서는 모든 입력을 한 번에 처리합니다.<br/>
        <span className="text-blue-600">💡 파일 선택 시 Ctrl(Cmd) + 클릭으로 여러 파일을 선택할 수 있습니다. 각 파일마다 별도의 Input Row가 생성됩니다.</span>
      </div>
      
      <div className="space-y-3">
        {inputs.map((row, idx) => (
          <div 
            key={idx} 
            className="flex items-center gap-2 p-3 bg-gray-25 rounded border border-gray-200" 
            onDrop={e => handleDrop(idx, e)} 
            onDragOver={e => e.preventDefault()}
          >
            {/* 타입 토글 - Property 제거됨 */}
            <div className="flex gap-1">
              <button 
                type="button" 
                className={`px-2 py-1 rounded text-sm ${row.type === 'text' ? 'bg-blue-100 text-blue-700' : 'bg-white border'}`} 
                onClick={() => editMode && setInputType(idx, 'text')} 
                disabled={!editMode}
              >
                Text
              </button>
              <button 
                type="button" 
                className={`px-2 py-1 rounded text-sm ${row.type === 'file' ? 'bg-blue-100 text-blue-700' : 'bg-white border'}`} 
                onClick={() => {
                  if (!editMode) return;
                  setInputType(idx, 'file');
                  setTimeout(() => fileInputRefs.current[idx]?.click(), 0);
                }} 
                disabled={!editMode}
              >
                File
              </button>
              <button 
                type="button" 
                className={`px-2 py-1 rounded text-sm ${row.type === 'flow-result' ? 'bg-blue-100 text-blue-700' : 'bg-white border'}`} 
                onClick={() => editMode && setInputType(idx, 'flow-result')} 
                disabled={!editMode}
              >
                Flow Result
              </button>
            </div>
            
            {/* 입력 UI */}
            {row.type === 'text' && (
              <textarea
                className="flex-1 border border-gray-300 rounded px-3 py-2 bg-gray-50 resize-none"
                rows={2}
                maxLength={500}
                value={typeof row.value === 'string' ? row.value : ''}
                onChange={e => editMode && handleTextChange(idx, e.target.value)}
                onKeyDown={e => editMode && handleKeyDown(e)}
                placeholder="입력값을 입력하세요"
                readOnly={!editMode}
                style={{ minHeight: '2.5rem', maxHeight: '4.5rem', overflow: 'auto' }}
              />
            )}
            
            {row.type === 'file' && (
              <div className="flex-1 flex items-center gap-2">
                <input
                  type="file"
                  className="hidden"
                  id={`file-input-${idx}`}
                  ref={el => fileInputRefs.current[idx] = el}
                  onChange={e => editMode && handleFileChange(idx, e.target.files)}
                  disabled={!editMode}
                  multiple
                />
                <button
                  type="button"
                  onClick={() => fileInputRefs.current[idx]?.click()}
                  className="px-3 py-2 bg-gray-50 border border-gray-300 rounded text-sm hover:bg-gray-100"
                  disabled={!editMode}
                >
                  파일 선택
                </button>
                {row.value && (
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-700">{getFileDisplayName(row.value)}</span>
                    <span className={`text-xs px-2 py-1 rounded ${
                      getFileStatus(row.value) === '백엔드 저장완료' 
                        ? 'bg-green-100 text-green-700' 
                        : 'bg-yellow-100 text-yellow-700'
                    }`}>
                      {getFileStatus(row.value)}
                    </span>
                  </div>
                )}
                {!row.value && <span className="text-gray-400 text-sm">파일을 선택하세요</span>}
              </div>
            )}
            
            {row.type === 'flow-result' && (
              <div className="flex-1 flex gap-2">
                {/* FlowChain 선택 */}
                <select
                  className="border border-gray-300 rounded px-2 py-1 bg-gray-50"
                  value={typeof row.flowChainId === 'string' ? row.flowChainId : ''}
                  onChange={e => {
                    if (!editMode) return;
                    const flowChainId = e.target.value;
                    const newInputs = [...inputs];
                    newInputs[idx] = { ...row, flowChainId, sourceFlowId: '', value: '' };
                    onInputsChange(newInputs);
                  }}
                  disabled={!editMode || flowChainIds.length === 0}
                >
                  <option value="">FlowChain 선택</option>
                  {flowChainIds
                    .filter(id => {
                      const currentChainIndex = flowChainIds.indexOf(String(focusedFlowChainId));
                      const targetChainIndex = flowChainIds.indexOf(id);
                      return targetChainIndex <= currentChainIndex;
                    })
                    .map(id => {
                      const isCurrentChain = id === focusedFlowChainId;
                      const name = flowChainMap[String(id)]?.name || id;
                      return (
                        <option key={id} value={id}>
                          {isCurrentChain ? `(현재)${name}` : name}
                        </option>
                      );
                    })}
                </select>
                
                {/* Flow 선택 */}
                {row.flowChainId && flowChainMap[String(row.flowChainId || '')] && (
                  <select
                    className="border border-gray-300 rounded px-2 py-1 bg-gray-50"
                    value={typeof row.sourceFlowId === 'string' ? row.sourceFlowId : ''}
                    onChange={e => {
                      if (!editMode) return;
                      const sourceFlowId = e.target.value;
                      const newInputs = [...inputs];
                      newInputs[idx] = { ...row, sourceFlowId, value: sourceFlowId };
                      onInputsChange(newInputs);
                    }}
                    disabled={!editMode}
                  >
                    <option value="">Flow 선택</option>
                    <option value="__all__">[Flow Chain 전체 결과]</option>
                    <option value="__selected__">[Flow Chain 선택 결과]</option>
                    <option disabled>────────────</option>
                    {(() => {
                      const selectedChain = flowChainMap[String(row.flowChainId || '')];
                      const isCurrentChain = row.flowChainId === focusedFlowChainId;
                      
                      return selectedChain.flowIds
                        .filter((fid: string) => {
                          if (isCurrentChain) {
                            const currentFlowIndex = selectedChain.flowIds.indexOf(flowId);
                            const targetFlowIndex = selectedChain.flowIds.indexOf(fid);
                            return targetFlowIndex < currentFlowIndex;
                          } else {
                            return true;
                          }
                        })
                        .map((fid: string) => {
                          const name = selectedChain.flowMap[fid]?.name || fid;
                          return (
                            <option key={fid} value={fid}>{name}</option>
                          );
                        });
                    })()}
                  </select>
                )}
              </div>
            )}
            
            {/* 위/아래/삭제 */}
            <div className="flex gap-1 ml-2">
              <button 
                type="button" 
                onClick={() => moveInput(idx, 'up')} 
                disabled={!editMode || idx === 0} 
                className="p-1 rounded hover:bg-gray-200 disabled:opacity-50"
              >
                {UpIcon}
              </button>
              <button 
                type="button" 
                onClick={() => moveInput(idx, 'down')} 
                disabled={!editMode || idx === inputs.length - 1} 
                className="p-1 rounded hover:bg-gray-200 disabled:opacity-50"
              >
                {DownIcon}
              </button>
              <button 
                type="button" 
                onClick={() => removeInput(idx)} 
                disabled={!editMode || inputs.length === 1} 
                className="p-1 rounded hover:bg-red-100 disabled:opacity-50"
              >
                {TrashIcon}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default InputDataSection; 