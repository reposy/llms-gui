import React, { useRef, useState } from 'react';
import { InputRow, InputType } from '../../../types/executor';
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
  
  // 통합 파일 업로드 훅 사용 (Flow Executor 컨텍스트)
  const { 
    uploading, 
    error: uploadError, 
    progress, 
    handleFileChange: unifiedFileChange,
    clearError 
  } = useUnifiedFileUpload(FILE_CONTEXTS.FLOW_EXECUTOR);

  const addInput = (row?: InputRow) => {
    const newRow = row || { type: 'text', value: '' };
    onInputsChange([...inputs, newRow]);
  };

  const removeInput = (idx: number) => {
    onInputsChange(inputs.filter((_, i) => i !== idx));
  };

  const moveInput = (idx: number, dir: 'up' | 'down') => {
    const newInputs = [...inputs];
    const targetIdx = dir === 'up' ? idx - 1 : idx + 1;
    if (targetIdx >= 0 && targetIdx < newInputs.length) {
      [newInputs[idx], newInputs[targetIdx]] = [newInputs[targetIdx], newInputs[idx]];
      onInputsChange(newInputs);
    }
  };

  const setInputType = (idx: number, type: InputType) => {
    const newInputs = [...inputs];
    newInputs[idx] = { 
      type, 
      value: type === 'flow-result' ? flowId : (type === 'file' ? null : ''),
      ...(type === 'flow-result' && { flowChainId: focusedFlowChainId, sourceFlowId: flowId })
    };
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
        console.log(`Flow Executor - Successfully uploaded ${result.files.length} files`);
      } else {
        console.error('Flow Executor - File upload failed:', result.error);
      }
    } catch (error) {
      console.error('Flow Executor - File upload error:', error);
    }
  };

  const handleTextChange = (idx: number, value: string) => {
    const newInputs = [...inputs];
    newInputs[idx] = { ...newInputs[idx], value };
    onInputsChange(newInputs);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      addInput();
    }
  };

  const handleDrop = async (idx: number, e: React.DragEvent) => {
    e.preventDefault();
    if (!editMode || !e.dataTransfer.files || e.dataTransfer.files.length === 0) return;

    const files = Array.from(e.dataTransfer.files);
    console.log(`Flow Executor - File drop at index ${idx}:`, files.map(f => f.name));
    
    try {
      // 통합 파일 업로드 사용 (드래그 앤 드롭)
      const result = await unifiedFileChange({
        target: { files: e.dataTransfer.files, value: '' }
      } as React.ChangeEvent<HTMLInputElement>);

      if (result.success && result.files.length > 0) {
        const newInputs = [...inputs];
        
        result.files.forEach((fileMetadata: BackendFileMetadata, fileIndex) => {
          if (fileIndex === 0) {
            newInputs[idx] = { 
              type: 'file', 
              value: fileMetadata,
              fileMetadata: fileMetadata
            };
          } else {
            newInputs.push({ 
              type: 'file', 
              value: fileMetadata,
              fileMetadata: fileMetadata
            });
          }
        });
        
        onInputsChange(newInputs);
        console.log(`Flow Executor - Successfully dropped ${result.files.length} files`);
      }
    } catch (error) {
      console.error('Flow Executor - File drop error:', error);
    }
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
      <div className="text-gray-500 text-sm mb-4">
        배치 모드에서는 모든 입력을 한 번에 처리합니다.<br/>
        <span className="text-blue-600">💡 파일 선택 시 Ctrl(Cmd) + 클릭으로 여러 파일을 선택할 수 있습니다. 각 파일마다 별도의 Input Row가 생성됩니다.</span>
        {uploading && <span className="text-orange-600 block mt-1">🔄 백엔드에 파일 업로드 중...</span>}
      </div>
      
      <div className="space-y-3">
        {inputs.map((row, idx) => (
          <div 
            key={idx} 
            className="flex items-center gap-2 p-3 bg-gray-25 rounded border border-gray-200" 
            onDrop={e => handleDrop(idx, e)} 
            onDragOver={e => e.preventDefault()}
          >
            {/* 타입 토글 */}
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
                  onChange={e => handleFileChange(idx, e.target.files)}
                  disabled={!editMode}
                  multiple
                  accept="image/*"
                />
                <button
                  type="button"
                  onClick={() => fileInputRefs.current[idx]?.click()}
                  className={`px-3 py-2 border border-gray-300 rounded text-sm transition-colors ${
                    editMode ? 'bg-gray-50 hover:bg-gray-100' : 'bg-gray-100 cursor-not-allowed'
                  }`}
                  disabled={!editMode || uploading}
                >
                  {uploading ? '업로드 중...' : '파일 선택'}
                </button>
                
                {/* 파일 정보 표시 */}
                {row.value && typeof row.value === 'object' && 'fileId' in row.value && (
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-700">
                      📎 {(row.value as BackendFileMetadata).originalFileName}
                    </span>
                    <span className="text-xs text-blue-600">
                      (백엔드 저장완료)
                    </span>
                  </div>
                )}
                {row.value && typeof row.value !== 'string' && !('fileId' in row.value) && (
                  <span className="text-sm text-gray-700">
                    📄 {(row.value as File).name}
                  </span>
                )}
                {!row.value && <span className="text-gray-400 text-sm">파일을 선택하세요</span>}
                
                {/* 업로드 진행률 */}
                {uploading && progress > 0 && (
                  <div className="flex items-center gap-2">
                    <div className="w-20 h-2 bg-gray-200 rounded">
                      <div 
                        className="h-full bg-blue-500 rounded transition-all"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                    <span className="text-xs text-gray-600">{progress}%</span>
                  </div>
                )}
                
                {/* 업로드 에러 */}
                {uploadError && (
                  <div className="flex items-center gap-1 text-red-600">
                    <span className="text-xs">❌ {uploadError}</span>
                    <button 
                      onClick={clearError}
                      className="text-xs underline hover:no-underline"
                    >
                      닫기
                    </button>
                  </div>
                )}
              </div>
            )}
            
            {/* Flow Result 타입 처리는 원본 코드와 동일 */}
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
                        .map((fid: string) => (
                          <option key={fid} value={fid}>
                            {fid}
                          </option>
                        ));
                    })()}
                  </select>
                )}
              </div>
            )}
            
            {/* 삭제/이동 버튼 */}
            {editMode && (
              <div className="flex gap-1 ml-2">
                <button 
                  type="button" 
                  onClick={() => moveInput(idx, 'up')} 
                  disabled={idx === 0}
                  className="text-gray-400 hover:text-gray-600 disabled:opacity-30"
                >
                  ↑
                </button>
                <button 
                  type="button" 
                  onClick={() => moveInput(idx, 'down')} 
                  disabled={idx === inputs.length - 1}
                  className="text-gray-400 hover:text-gray-600 disabled:opacity-30"
                >
                  ↓
                </button>
                <button 
                  type="button" 
                  onClick={() => removeInput(idx)} 
                  className="text-red-400 hover:text-red-600 ml-1"
                >
                  ✕
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
      
      {inputs.length === 0 && (
        <div className="text-center py-6 text-gray-400 border border-dashed border-gray-300 rounded">
          입력 데이터가 없습니다. 위의 버튼을 클릭하여 데이터를 추가하세요.
        </div>
      )}
    </div>
  );
};

export default InputDataSection; 