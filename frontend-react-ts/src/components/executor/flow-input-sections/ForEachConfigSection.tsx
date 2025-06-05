import React, { useCallback } from 'react';
import type { InputRow, InputType } from '../../../types/flow/InputRow';
import { BackendFileMetadata, FILE_CONTEXTS } from '../../../types/files';
import { useUnifiedFileUpload } from '../../../hooks/useUnifiedFileUpload';
import { 
  LLMPropertyForm, 
  APIPropertyForm, 
  WebCrawlerPropertyForm,
  parseProperty,
  createDefaultProperty,
  serializeProperty,
  type LLMProperty,
  type APIProperty,
  type WebCrawlerProperty
} from '../PropertyForms';

interface ForEachConfigSectionProps {
  commonInputs: InputRow[];
  forEachItems: InputRow[];
  onCommonInputsChange: (inputs: InputRow[]) => void;
  onForEachItemsChange: (items: InputRow[]) => void;
  editMode: boolean;
  flowId: string;
  focusedFlowChainId?: string;
  flowChainIds: string[];
  flowChainMap: Record<string, any>;
}

// 입력 행 컴포넌트 분리
interface InputRowComponentProps {
  item: InputRow;
  idx: number;
  isForEach?: boolean;
  editMode: boolean;
  onTextChange: (idx: number, value: string) => void;
  onFileChange: (idx: number, files: BackendFileMetadata[]) => void;
  onPropertyChange: (idx: number, nodeType: string, propertyValue: any) => void;
  onTypeChange: (idx: number, type: InputType) => void;
  onRemove: (idx: number) => void;
  onMoveUp: (idx: number) => void;
  onMoveDown: (idx: number) => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  flowId: string;
  focusedFlowChainId?: string;
  flowChainIds: string[];
  flowChainMap: Record<string, any>;
  canMoveUp: boolean;
  canMoveDown: boolean;
  uploading: boolean;
  uploadError: string | null;
  uploadProgress: number;
}

const InputRowComponent: React.FC<InputRowComponentProps> = ({
  item,
  idx,
  isForEach = false,
  editMode,
  onTextChange,
  onFileChange,
  onPropertyChange,
  onTypeChange,
  onRemove,
  onMoveUp,
  onMoveDown,
  onKeyDown,
  flowId,
  focusedFlowChainId,
  flowChainIds,
  flowChainMap,
  canMoveUp,
  canMoveDown,
  uploading,
  uploadError,
  uploadProgress
}) => {
  const inputId = `${isForEach ? 'foreach' : 'common'}-file-input-${idx}`;
  
  const handleFileSelect = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files?.length || !editMode) return;
    
    // UnifiedFileService를 사용하여 파일 업로드
    const files = Array.from(event.target.files);
    const { UnifiedFileService } = await import('../../../services/unifiedFileService');
    
    try {
      const uploadedFiles: BackendFileMetadata[] = [];
      
      for (const file of files) {
        const uploadedFile = await UnifiedFileService.getInstance().uploadFile(file, FILE_CONTEXTS.FLOW_EXECUTOR);
        uploadedFiles.push(uploadedFile);
      }
      
      if (uploadedFiles.length > 0) {
        onFileChange(idx, uploadedFiles);
      }
    } catch (error) {
      console.error('File upload failed:', error);
    }
  }, [editMode, idx, onFileChange]);

  return (
    <div className="flex items-center gap-2 p-3 border-b border-gray-200 last:border-b-0">
      {/* 타입 선택 */}
      <select
        className="border border-gray-300 rounded px-2 py-1 bg-gray-50 text-xs w-24"
        value={item.type}
        onChange={e => editMode && onTypeChange(idx, e.target.value as InputType)}
        disabled={!editMode}
      >
        <option value="text">Text</option>
        <option value="file">File</option>
        <option value="flow-result">Flow Result</option>
        <option value="property">Property</option>
      </select>
      
      {/* 입력 UI */}
      {item.type === 'text' && (
        <textarea
          className="flex-1 border border-gray-300 rounded px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500 bg-gray-50 resize-none"
          rows={2}
          maxLength={500}
          value={typeof item.value === 'string' ? item.value : ''}
          onChange={(e) => onTextChange(idx, e.target.value)}
          onKeyDown={e => editMode && onKeyDown(e)}
          placeholder={isForEach ? "ForEach 아이템" : "공통 입력"}
          readOnly={!editMode}
          style={{ minHeight: '2.5rem', maxHeight: '4.5rem', overflow: 'auto' }}
        />
      )}
      
      {item.type === 'file' && (
        <div className="flex-1 flex items-center gap-2">
          <input
            type="file"
            className="hidden"
            id={inputId}
            onChange={handleFileSelect}
            disabled={!editMode || uploading}
            multiple
            accept="image/*"
          />
          <button
            type="button"
            onClick={() => document.getElementById(inputId)?.click()}
            className={`px-3 py-2 border border-gray-300 rounded text-sm transition-colors ${
              uploading 
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed' 
                : 'bg-gray-50 hover:bg-gray-100'
            }`}
            disabled={!editMode || uploading}
          >
            {uploading ? '업로드중...' : '파일 선택'}
          </button>
          
          {/* 파일 표시 */}
          {item.value && (
            <div className="flex items-center gap-2">
              {typeof item.value === 'object' && 'originalFileName' in item.value ? (
                // BackendFileMetadata
                <div className="flex items-center gap-1">
                  <span className="text-sm text-green-700">📄 {item.value.originalFileName}</span>
                  <span className="text-xs text-green-600 bg-green-100 px-1 rounded">백엔드 저장완료</span>
                </div>
              ) : item.value instanceof File ? (
                // File 객체 (레거시)
                <div className="flex items-center gap-1">
                  <span className="text-sm text-gray-700">📄 {item.value.name}</span>
                  <span className="text-xs text-orange-600 bg-orange-100 px-1 rounded">로컬 파일</span>
                </div>
              ) : (
                <span className="text-sm text-gray-500">알 수 없는 파일</span>
              )}
            </div>
          )}
          
          {!item.value && <span className="text-gray-400 text-sm">파일을 선택하세요</span>}
          
          {/* 업로드 진행률 */}
          {uploading && uploadProgress > 0 && (
            <div className="flex items-center gap-2">
              <div className="w-16 h-2 bg-gray-200 rounded">
                <div 
                  className="h-full bg-blue-500 rounded transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
              <span className="text-xs text-gray-600">{uploadProgress}%</span>
            </div>
          )}
          
          {/* 업로드 에러 */}
          {uploadError && (
            <span className="text-xs text-red-600">❌ {uploadError}</span>
          )}
        </div>
      )}
      
      {item.type === 'flow-result' && (
        <div className="flex-1 flex gap-2">
          {/* FlowChain 선택 */}
          <select
            className="border border-gray-300 rounded px-2 py-1 bg-gray-50 text-xs"
            value={typeof item.flowChainId === 'string' ? item.flowChainId : ''}
            onChange={e => {
              if (!editMode) return;
              const flowChainId = e.target.value;
              // Flow result 업데이트를 위한 추가 핸들러 호출
              onTextChange(idx, flowChainId); // 임시로 value를 flowChainId로 설정
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
          {item.flowChainId && flowChainMap[String(item.flowChainId || '')] && (
            <select
              className="border border-gray-300 rounded px-2 py-1 bg-gray-50 text-xs"
              value={typeof item.sourceFlowId === 'string' ? item.sourceFlowId : ''}
              onChange={e => {
                if (!editMode) return;
                const sourceFlowId = e.target.value;
                onTextChange(idx, sourceFlowId); // 임시로 value를 sourceFlowId로 설정
              }}
              disabled={!editMode}
            >
              <option value="">Flow 선택</option>
              <option value="__all__">[Flow Chain 전체 결과]</option>
              <option value="__selected__">[Flow Chain 선택 결과]</option>
              <option disabled>────────────</option>
              {(() => {
                const selectedChain = flowChainMap[String(item.flowChainId || '')];
                const isCurrentChain = item.flowChainId === focusedFlowChainId;
                
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
      
      {item.type === 'property' && (
        <div className="flex-1">
          {(() => {
            const parsed = parseProperty(item.value as string);
            if (!parsed) {
              return (
                <div className="text-red-600 text-sm p-2 border border-red-200 rounded bg-red-50">
                  잘못된 Property 형식
                </div>
              );
            }
            
            const { nodeType, property: propertyValue } = parsed;
            
            return (
              <div className="p-2 border border-gray-200 rounded bg-gray-50">
                {nodeType === 'llm' && (
                  <LLMPropertyForm
                    value={propertyValue as LLMProperty}
                    onChange={(newValue) => onPropertyChange(idx, 'llm', newValue)}
                    disabled={!editMode}
                  />
                )}
                {nodeType === 'api' && (
                  <APIPropertyForm
                    value={propertyValue as APIProperty}
                    onChange={(newValue) => onPropertyChange(idx, 'api', newValue)}
                    disabled={!editMode}
                  />
                )}
                {nodeType === 'web-crawler' && (
                  <WebCrawlerPropertyForm
                    value={propertyValue as WebCrawlerProperty}
                    onChange={(newValue) => onPropertyChange(idx, 'web-crawler', newValue)}
                    disabled={!editMode}
                  />
                )}
              </div>
            );
          })()}
        </div>
      )}
      
      {editMode && (
        <button 
          onClick={() => onRemove(idx)}
          className="text-red-600 hover:bg-red-100 px-2 py-1 rounded text-xs transition-colors"
        >
          삭제
        </button>
      )}
      
      {editMode && (canMoveUp || canMoveDown) && (
        <div className="flex flex-col gap-1">
          <button
            onClick={() => onMoveUp(idx)}
            disabled={!canMoveUp}
            className="text-gray-600 hover:bg-gray-100 px-1 py-1 rounded text-xs transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            title="위로 이동"
          >
            ↑
          </button>
          <button
            onClick={() => onMoveDown(idx)}
            disabled={!canMoveDown}
            className="text-gray-600 hover:bg-gray-100 px-1 py-1 rounded text-xs transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            title="아래로 이동"
          >
            ↓
          </button>
        </div>
      )}
    </div>
  );
};

const ForEachConfigSection: React.FC<ForEachConfigSectionProps> = ({
  commonInputs,
  forEachItems,
  onCommonInputsChange,
  onForEachItemsChange,
  editMode,
  flowId,
  focusedFlowChainId,
  flowChainIds,
  flowChainMap
}) => {
  // 통합 파일 업로드 훅 사용
  const { 
    uploading, 
    error: uploadError, 
    progress: uploadProgress,
    clearError: clearUploadError
  } = useUnifiedFileUpload(FILE_CONTEXTS.FLOW_EXECUTOR);

  // Common Inputs 헬퍼 함수들
  const addCommonInput = useCallback((row?: InputRow) => {
    if (!editMode) return;
    onCommonInputsChange([...commonInputs, row || { type: 'text', value: '' }]);
  }, [editMode, commonInputs, onCommonInputsChange]);

  const removeCommonInput = useCallback((idx: number) => {
    if (!editMode) return;
    onCommonInputsChange(commonInputs.filter((_, i) => i !== idx));
  }, [editMode, commonInputs, onCommonInputsChange]);

  const setCommonInputType = useCallback((idx: number, type: InputType) => {
    if (!editMode) return;
    const newInputs = [...commonInputs];
    if (type === 'file') newInputs[idx] = { type, value: null };
    else if (type === 'flow-result') newInputs[idx] = {
      type,
      value: flowId,
      flowChainId: focusedFlowChainId || undefined,
      sourceFlowId: flowId
    };
    else if (type === 'property') newInputs[idx] = { type, value: serializeProperty('llm', createDefaultProperty('llm')) };
    else newInputs[idx] = { type, value: '' };
    onCommonInputsChange(newInputs);
  }, [editMode, commonInputs, onCommonInputsChange, flowId, focusedFlowChainId]);

  const handleCommonInputTextChange = useCallback((idx: number, value: string) => {
    if (!editMode) return;
    const newInputs = [...commonInputs];
    newInputs[idx] = { ...newInputs[idx], value };
    onCommonInputsChange(newInputs);
  }, [editMode, commonInputs, onCommonInputsChange]);

  const handleCommonInputKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && e.shiftKey) {
      e.preventDefault();
      addCommonInput();
    }
  }, [addCommonInput]);

  const handleCommonInputFileChange = useCallback((idx: number, files: BackendFileMetadata[]) => {
    if (!editMode || files.length === 0) return;
    
    const newInputs = [...commonInputs];
    
    if (files.length === 1) {
      // 단일 파일 선택
      newInputs[idx] = { type: 'file', value: files[0] };
    } else {
      // 다중 파일 선택: 첫 번째 파일로 현재 row 업데이트, 나머지는 새 row 추가
      newInputs[idx] = { type: 'file', value: files[0] };
      
      const additionalRows = files.slice(1).map(file => ({
        type: 'file' as const,
        value: file
      }));
      
      newInputs.splice(idx + 1, 0, ...additionalRows);
    }
    
    onCommonInputsChange(newInputs);
  }, [editMode, commonInputs, onCommonInputsChange]);

  const handleCommonInputPropertyChange = useCallback((idx: number, nodeType: string, propertyValue: any) => {
    if (!editMode) return;
    const newInputs = [...commonInputs];
    const newValue = serializeProperty(nodeType, propertyValue);
    newInputs[idx] = { ...newInputs[idx], value: newValue };
    onCommonInputsChange(newInputs);
  }, [editMode, commonInputs, onCommonInputsChange]);

  // 순서 변경 헬퍼 함수들
  const moveCommonInputUp = useCallback((idx: number) => {
    if (!editMode || idx === 0) return;
    const newInputs = [...commonInputs];
    [newInputs[idx], newInputs[idx - 1]] = [newInputs[idx - 1], newInputs[idx]];
    onCommonInputsChange(newInputs);
  }, [editMode, commonInputs, onCommonInputsChange]);

  const moveCommonInputDown = useCallback((idx: number) => {
    if (!editMode || idx === commonInputs.length - 1) return;
    const newInputs = [...commonInputs];
    [newInputs[idx], newInputs[idx + 1]] = [newInputs[idx + 1], newInputs[idx]];
    onCommonInputsChange(newInputs);
  }, [editMode, commonInputs, onCommonInputsChange]);

  // ForEach Items 헬퍼 함수들
  const addForEachItem = useCallback((row?: InputRow) => {
    if (!editMode) return;
    onForEachItemsChange([...forEachItems, row || { type: 'text', value: '' }]);
  }, [editMode, forEachItems, onForEachItemsChange]);

  const removeForEachItem = useCallback((idx: number) => {
    if (!editMode) return;
    onForEachItemsChange(forEachItems.filter((_, i) => i !== idx));
  }, [editMode, forEachItems, onForEachItemsChange]);

  const setForEachItemType = useCallback((idx: number, type: InputType) => {
    if (!editMode) return;
    const newItems = [...forEachItems];
    if (type === 'file') newItems[idx] = { type, value: null };
    else if (type === 'flow-result') newItems[idx] = {
      type,
      value: flowId,
      flowChainId: focusedFlowChainId || undefined,
      sourceFlowId: flowId
    };
    else if (type === 'property') newItems[idx] = { type, value: serializeProperty('llm', createDefaultProperty('llm')) };
    else newItems[idx] = { type, value: '' };
    onForEachItemsChange(newItems);
  }, [editMode, forEachItems, onForEachItemsChange, flowId, focusedFlowChainId]);

  const handleForEachItemTextChange = useCallback((idx: number, value: string) => {
    if (!editMode) return;
    const newItems = [...forEachItems];
    newItems[idx] = { ...newItems[idx], value };
    onForEachItemsChange(newItems);
  }, [editMode, forEachItems, onForEachItemsChange]);

  const handleForEachItemKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && e.shiftKey) {
      e.preventDefault();
      addForEachItem();
    }
  }, [addForEachItem]);

  const handleForEachItemFileChange = useCallback((idx: number, files: BackendFileMetadata[]) => {
    if (!editMode || files.length === 0) return;
    
    const newItems = [...forEachItems];
    
    if (files.length === 1) {
      // 단일 파일 선택
      newItems[idx] = { type: 'file', value: files[0] };
    } else {
      // 다중 파일 선택: 첫 번째 파일로 현재 row 업데이트, 나머지는 새 row 추가
      newItems[idx] = { type: 'file', value: files[0] };
      
      const additionalRows = files.slice(1).map(file => ({
        type: 'file' as const,
        value: file
      }));
      
      newItems.splice(idx + 1, 0, ...additionalRows);
    }
    
    onForEachItemsChange(newItems);
  }, [editMode, forEachItems, onForEachItemsChange]);

  const handleForEachItemPropertyChange = useCallback((idx: number, nodeType: string, propertyValue: any) => {
    if (!editMode) return;
    const newItems = [...forEachItems];
    const newValue = serializeProperty(nodeType, propertyValue);
    newItems[idx] = { ...newItems[idx], value: newValue };
    onForEachItemsChange(newItems);
  }, [editMode, forEachItems, onForEachItemsChange]);

  const moveForEachItemUp = useCallback((idx: number) => {
    if (!editMode || idx === 0) return;
    const newItems = [...forEachItems];
    [newItems[idx], newItems[idx - 1]] = [newItems[idx - 1], newItems[idx]];
    onForEachItemsChange(newItems);
  }, [editMode, forEachItems, onForEachItemsChange]);

  const moveForEachItemDown = useCallback((idx: number) => {
    if (!editMode || idx === forEachItems.length - 1) return;
    const newItems = [...forEachItems];
    [newItems[idx], newItems[idx + 1]] = [newItems[idx + 1], newItems[idx]];
    onForEachItemsChange(newItems);
  }, [editMode, forEachItems, onForEachItemsChange]);

  return (
    <div className="space-y-6">
      {/* 백엔드 파일 시스템 상태 표시 */}
      <div className="p-3 bg-green-50 border border-green-200 rounded-md">
        <div className="flex items-start">
          <div className="h-4 w-4 text-green-500 mr-2">✅</div>
          <div className="flex-grow">
            <p className="text-sm text-green-700 font-medium">
              통합 파일 시스템 활성화
            </p>
            <p className="text-xs text-green-600 mt-1">
              파일이 백엔드에 안전하게 저장되어 새로고침 시에도 유지됩니다
            </p>
          </div>
          {uploadError && (
            <button 
              onClick={clearUploadError}
              className="text-green-400 hover:text-green-600 ml-2"
            >
              ❌
            </button>
          )}
        </div>
      </div>

      {/* Common Inputs 섹션 */}
      <div className="bg-white border border-gray-300 rounded-lg overflow-hidden">
        <div className="bg-purple-50 border-b border-purple-200 px-4 py-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-purple-800">Common Inputs</h3>
            {editMode && (
              <div className="flex gap-2">
                <button
                  onClick={() => addCommonInput({ type: 'text', value: '' })}
                  className="text-purple-600 hover:bg-purple-100 px-2 py-1 rounded text-xs transition-colors"
                >
                  + Text
                </button>
                <button
                  onClick={() => addCommonInput({ type: 'file', value: null })}
                  className="text-purple-600 hover:bg-purple-100 px-2 py-1 rounded text-xs transition-colors"
                >
                  + File
                </button>
                <button
                  onClick={() => addCommonInput({ type: 'flow-result', value: flowId, flowChainId: focusedFlowChainId, sourceFlowId: flowId })}
                  className="text-purple-600 hover:bg-purple-100 px-2 py-1 rounded text-xs transition-colors"
                  disabled={flowChainIds.length === 0}
                >
                  + Flow Result
                </button>
                <button
                  onClick={() => addCommonInput({ type: 'property', value: serializeProperty('llm', createDefaultProperty('llm')) })}
                  className="text-purple-600 hover:bg-purple-100 px-2 py-1 rounded text-xs transition-colors"
                >
                  + Property
                </button>
              </div>
            )}
          </div>
        </div>
        
        <div className="bg-white">
          {commonInputs.length === 0 ? (
            <div className="p-6 text-center text-gray-500 text-sm">
              공통 입력이 없습니다. {editMode && '위의 버튼을 클릭하여 추가하세요.'}
            </div>
          ) : (
            commonInputs.map((item, idx) => (
              <InputRowComponent
                key={idx}
                item={item}
                idx={idx}
                isForEach={false}
                editMode={editMode}
                onTextChange={handleCommonInputTextChange}
                onFileChange={handleCommonInputFileChange}
                onPropertyChange={handleCommonInputPropertyChange}
                onTypeChange={setCommonInputType}
                onRemove={removeCommonInput}
                onMoveUp={moveCommonInputUp}
                onMoveDown={moveCommonInputDown}
                onKeyDown={handleCommonInputKeyDown}
                flowId={flowId}
                focusedFlowChainId={focusedFlowChainId}
                flowChainIds={flowChainIds}
                flowChainMap={flowChainMap}
                canMoveUp={idx > 0}
                canMoveDown={idx < commonInputs.length - 1}
                uploading={uploading}
                uploadError={uploadError}
                uploadProgress={uploadProgress}
              />
            ))
          )}
        </div>
      </div>

      {/* ForEach Items 섹션 */}
      <div className="bg-white border border-gray-300 rounded-lg overflow-hidden">
        <div className="bg-green-50 border-b border-green-200 px-4 py-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-green-800">ForEach Items</h3>
            {editMode && (
              <div className="flex gap-2">
                <button
                  onClick={() => addForEachItem({ type: 'text', value: '' })}
                  className="text-green-600 hover:bg-green-100 px-2 py-1 rounded text-xs transition-colors"
                >
                  + Text
                </button>
                <button
                  onClick={() => addForEachItem({ type: 'file', value: null })}
                  className="text-green-600 hover:bg-green-100 px-2 py-1 rounded text-xs transition-colors"
                >
                  + File
                </button>
                <button
                  onClick={() => addForEachItem({ type: 'flow-result', value: flowId, flowChainId: focusedFlowChainId, sourceFlowId: flowId })}
                  className="text-green-600 hover:bg-green-100 px-2 py-1 rounded text-xs transition-colors"
                  disabled={flowChainIds.length === 0}
                >
                  + Flow Result
                </button>
                <button
                  onClick={() => addForEachItem({ type: 'property', value: serializeProperty('llm', createDefaultProperty('llm')) })}
                  className="text-green-600 hover:bg-green-100 px-2 py-1 rounded text-xs transition-colors"
                >
                  + Property
                </button>
              </div>
            )}
          </div>
        </div>
        
        <div className="bg-white">
          {forEachItems.length === 0 ? (
            <div className="p-6 text-center text-gray-500 text-sm">
              ForEach 아이템이 없습니다. {editMode && '위의 버튼을 클릭하여 추가하세요.'}
            </div>
          ) : (
            forEachItems.map((item, idx) => (
              <InputRowComponent
                key={idx}
                item={item}
                idx={idx}
                isForEach={true}
                editMode={editMode}
                onTextChange={handleForEachItemTextChange}
                onFileChange={handleForEachItemFileChange}
                onPropertyChange={handleForEachItemPropertyChange}
                onTypeChange={setForEachItemType}
                onRemove={removeForEachItem}
                onMoveUp={moveForEachItemUp}
                onMoveDown={moveForEachItemDown}
                onKeyDown={handleForEachItemKeyDown}
                flowId={flowId}
                focusedFlowChainId={focusedFlowChainId}
                flowChainIds={flowChainIds}
                flowChainMap={flowChainMap}
                canMoveUp={idx > 0}
                canMoveDown={idx < forEachItems.length - 1}
                uploading={uploading}
                uploadError={uploadError}
                uploadProgress={uploadProgress}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default ForEachConfigSection; 