import React from 'react';
import type { InputRow } from '../../../types/flow/InputRow';
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

interface NodePropertiesSectionProps {
  properties: InputRow[];
  onPropertiesChange: (properties: InputRow[]) => void;
  editMode: boolean;
}

const NodePropertiesSection: React.FC<NodePropertiesSectionProps> = ({
  properties,
  onPropertiesChange,
  editMode
}) => {
  const TrashIcon = (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
    </svg>
  );

  const addProperty = (nodeType: string) => {
    if (!editMode) return;
    
    const defaultProperty = createDefaultProperty(nodeType);
    const newPropertyValue = serializeProperty(nodeType, defaultProperty);
    const newProperty: InputRow = { type: 'property', value: newPropertyValue };
    
    onPropertiesChange([...properties, newProperty]);
  };

  const removeProperty = (idx: number) => {
    if (!editMode) return;
    onPropertiesChange(properties.filter((_, i) => i !== idx));
  };

  const handlePropertyChange = (idx: number, nodeType: string, propertyValue: any) => {
    if (!editMode) return;
    const newProperties = [...properties];
    const newValue = serializeProperty(nodeType, propertyValue);
    newProperties[idx] = { ...newProperties[idx], value: newValue };
    onPropertiesChange(newProperties);
  };

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-md font-medium text-gray-800">Node Properties</h3>
        {editMode && (
          <div className="flex gap-2">
            <button 
              className="px-3 py-1 bg-blue-100 text-blue-700 rounded text-sm"
              onClick={() => addProperty('llm')}
            >
              + LLM
            </button>
            <button 
              className="px-3 py-1 bg-green-100 text-green-700 rounded text-sm"
              onClick={() => addProperty('api')}
            >
              + API
            </button>
            <button 
              className="px-3 py-1 bg-purple-100 text-purple-700 rounded text-sm"
              onClick={() => addProperty('web-crawler')}
            >
              + Web Crawler
            </button>
          </div>
        )}
      </div>
      
      {properties.length === 0 ? (
        <div className="text-gray-400 text-sm p-4 border-2 border-dashed border-gray-200 rounded text-center">
          노드 속성이 없습니다. 위의 버튼을 클릭하여 추가하세요.
        </div>
      ) : (
        <div className="space-y-4">
          {properties.map((property, idx) => {
            const parsed = parseProperty(property.value as string);
            if (!parsed) {
              return (
                <div key={idx} className="p-4 border border-red-200 rounded bg-red-50">
                  <div className="flex justify-between items-center">
                    <span className="text-red-600 text-sm">잘못된 Property 형식</span>
                    {editMode && (
                      <button 
                        onClick={() => removeProperty(idx)}
                        className="text-red-600 hover:bg-red-100 p-1 rounded"
                      >
                        {TrashIcon}
                      </button>
                    )}
                  </div>
                </div>
              );
            }

            const { nodeType, property: propertyValue } = parsed;
            
            return (
              <div key={idx} className="relative">
                {editMode && (
                  <button 
                    onClick={() => removeProperty(idx)}
                    className="absolute top-2 right-2 z-10 text-red-600 hover:bg-red-100 p-1 rounded"
                  >
                    {TrashIcon}
                  </button>
                )}
                {nodeType === 'llm' && (
                  <LLMPropertyForm
                    value={propertyValue as LLMProperty}
                    onChange={(newValue) => handlePropertyChange(idx, 'llm', newValue)}
                    disabled={!editMode}
                  />
                )}
                {nodeType === 'api' && (
                  <APIPropertyForm
                    value={propertyValue as APIProperty}
                    onChange={(newValue) => handlePropertyChange(idx, 'api', newValue)}
                    disabled={!editMode}
                  />
                )}
                {nodeType === 'web-crawler' && (
                  <WebCrawlerPropertyForm
                    value={propertyValue as WebCrawlerProperty}
                    onChange={(newValue) => handlePropertyChange(idx, 'web-crawler', newValue)}
                    disabled={!editMode}
                  />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default NodePropertiesSection; 