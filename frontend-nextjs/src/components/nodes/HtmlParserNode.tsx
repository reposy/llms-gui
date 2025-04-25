import React, { useState, useEffect, useCallback, memo } from 'react';
import { Handle, Position, NodeProps, useReactFlow } from 'reactflow';
import { IconSettings, IconTrash } from '@tabler/icons-react';
import { fetchApi } from '@/utils/api';
import { NodeData } from '@/types/flow';
import useStore from '@/store/useStore';
import styles from '@/styles/Node.module.css';

export interface ExtractionRule {
  id: string;
  name: string;
  selector: string;
  target: 'text' | 'attribute' | 'html';
  attribute_name?: string;
  multiple: boolean;
}

export interface HtmlParserNodeData extends NodeData {
  extractionRules: ExtractionRule[];
  outputData?: Record<string, any>;
  inputData?: string;
  error?: string;
}

const HtmlParserNode = ({ id, data, selected }: NodeProps<HtmlParserNodeData>) => {
  const { setNodes } = useReactFlow();
  const updateNodeData = useStore((state) => state.updateNodeData);
  const openNodeSettings = useStore((state) => state.openNodeSettings);

  // Function to handle incoming data
  const processHtmlContent = useCallback(async (htmlContent: string) => {
    if (!htmlContent || !data.extractionRules || data.extractionRules.length === 0) {
      return;
    }

    try {
      // Prepare extraction rules for API call by removing the id which is only for frontend
      const apiExtractionRules = data.extractionRules.map(rule => ({
        name: rule.name,
        selector: rule.selector,
        target: rule.target,
        attribute_name: rule.attribute_name,
        multiple: rule.multiple
      }));

      const response = await fetchApi('/api/html-parser/parse', {
        method: 'POST',
        body: JSON.stringify({
          html_content: htmlContent,
          extraction_rules: apiExtractionRules
        })
      });

      if (response.status === 'success') {
        updateNodeData(id, {
          outputData: response.data,
          error: undefined
        });
      } else {
        updateNodeData(id, {
          outputData: undefined,
          error: response.error || 'Failed to parse HTML'
        });
      }
    } catch (error) {
      console.error('Error parsing HTML:', error);
      updateNodeData(id, {
        outputData: undefined,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      });
    }
  }, [id, data.extractionRules, updateNodeData]);

  // Process HTML when input data changes
  useEffect(() => {
    if (data.inputData) {
      processHtmlContent(data.inputData);
    }
  }, [data.inputData, processHtmlContent]);

  const handleDelete = () => {
    setNodes(nodes => nodes.filter(node => node.id !== id));
  };

  const handleSettings = () => {
    openNodeSettings(id, 'HtmlParser');
  };

  // Calculate node status
  const getStatusColor = () => {
    if (data.error) return 'red';
    if (data.outputData) return 'green';
    return 'gray';
  };

  return (
    <div className={`${styles.node} ${selected ? styles.selected : ''}`}>
      <div className={styles.nodeHeader}>
        <div className={styles.nodeTitle}>HTML Parser</div>
        <div className={styles.nodeActions}>
          <button className={styles.nodeActionBtn} onClick={handleSettings}>
            <IconSettings size={16} />
          </button>
          <button className={styles.nodeActionBtn} onClick={handleDelete}>
            <IconTrash size={16} />
          </button>
        </div>
      </div>
      
      <div className={styles.nodeContent}>
        <div className={styles.statusIndicator} style={{ backgroundColor: getStatusColor() }}></div>
        <div className={styles.nodeStats}>
          <div>Rules: {data.extractionRules?.length || 0}</div>
          {data.outputData && <div>Results: {Object.keys(data.outputData).length}</div>}
        </div>
        {data.error && <div className={styles.errorText}>{data.error}</div>}
      </div>

      {/* Input handle - receives HTML content */}
      <Handle
        type="target"
        position={Position.Left}
        id="html-input"
        className={styles.handle}
      />
      
      {/* Output handle - provides extracted data */}
      <Handle 
        type="source"
        position={Position.Right}
        id="data-output"
        className={styles.handle}
      />
    </div>
  );
};

export default memo(HtmlParserNode); 