import React, { useState, useEffect } from 'react';
import { useReactFlow } from 'reactflow';
import { v4 as uuidv4 } from 'uuid';
import { IconPlus, IconTrash, IconEdit, IconDeviceFloppy, IconX } from '@tabler/icons-react';
import useStore from '@/store/useStore';
import styles from '@/styles/Settings.module.css';
import { ExtractionRule } from '../nodes/HtmlParserNode';

const HtmlParserSettings = () => {
  const { selectedNodeId, closeNodeSettings, updateNodeData } = useStore();
  const { getNode } = useReactFlow();
  const node = getNode(selectedNodeId || '');
  
  const [rules, setRules] = useState<ExtractionRule[]>([]);
  const [editingRule, setEditingRule] = useState<ExtractionRule | null>(null);
  const [showForm, setShowForm] = useState(false);

  // Initialize form state
  const [formData, setFormData] = useState<ExtractionRule>({
    id: '',
    name: '',
    selector: '',
    target: 'text',
    attribute_name: '',
    multiple: false
  });

  // Load rules from node data
  useEffect(() => {
    if (node && node.data.extractionRules) {
      setRules(node.data.extractionRules);
    } else {
      setRules([]);
    }
  }, [node]);

  // Update node data when rules change
  useEffect(() => {
    if (selectedNodeId) {
      updateNodeData(selectedNodeId, { extractionRules: rules });
    }
  }, [rules, selectedNodeId, updateNodeData]);

  const handleAddRule = () => {
    setEditingRule(null);
    setFormData({
      id: uuidv4(),
      name: '',
      selector: '',
      target: 'text',
      attribute_name: '',
      multiple: false
    });
    setShowForm(true);
  };

  const handleEditRule = (rule: ExtractionRule) => {
    setEditingRule(rule);
    setFormData({ ...rule });
    setShowForm(true);
  };

  const handleDeleteRule = (id: string) => {
    setRules(rules.filter(rule => rule.id !== id));
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    
    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData({ ...formData, [name]: checked });
    } else {
      setFormData({ ...formData, [name]: value });
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate form
    if (!formData.name || !formData.selector) {
      alert('Name and selector are required');
      return;
    }

    if (formData.target === 'attribute' && !formData.attribute_name) {
      alert('Attribute name is required when target is attribute');
      return;
    }

    if (editingRule) {
      // Update existing rule
      setRules(rules.map(rule => 
        rule.id === editingRule.id ? formData : rule
      ));
    } else {
      // Add new rule
      setRules([...rules, formData]);
    }

    // Reset form
    setShowForm(false);
    setEditingRule(null);
    setFormData({
      id: '',
      name: '',
      selector: '',
      target: 'text',
      attribute_name: '',
      multiple: false
    });
  };

  const cancelForm = () => {
    setShowForm(false);
    setEditingRule(null);
  };

  return (
    <div className={styles.settingsPanel}>
      <div className={styles.settingsHeader}>
        <h2>HTML Parser Settings</h2>
        <button className={styles.closeButton} onClick={closeNodeSettings}>
          <IconX size={20} />
        </button>
      </div>

      <div className={styles.settingsContent}>
        <div className={styles.settingsSection}>
          <div className={styles.sectionHeader}>
            <h3>Extraction Rules</h3>
            <button 
              className={styles.addButton} 
              onClick={handleAddRule}
              disabled={showForm}
            >
              <IconPlus size={18} /> Add Rule
            </button>
          </div>

          {/* Rules List */}
          <div className={styles.rulesList}>
            {rules.length === 0 && !showForm && (
              <div className={styles.emptyState}>
                No extraction rules defined. Add rules to extract data from HTML.
              </div>
            )}
            
            {rules.map((rule) => (
              <div key={rule.id} className={styles.ruleItem}>
                <div className={styles.ruleInfo}>
                  <div className={styles.ruleName}>{rule.name}</div>
                  <div className={styles.ruleDetails}>
                    <span className={styles.ruleSelector}>{rule.selector}</span>
                    <span className={styles.ruleTarget}>
                      {rule.target === 'attribute' 
                        ? `@${rule.attribute_name}` 
                        : rule.target}
                    </span>
                    {rule.multiple && <span className={styles.ruleMultiple}>Multiple</span>}
                  </div>
                </div>
                <div className={styles.ruleActions}>
                  <button 
                    className={styles.actionButton} 
                    onClick={() => handleEditRule(rule)}
                    disabled={showForm}
                  >
                    <IconEdit size={16} />
                  </button>
                  <button 
                    className={styles.actionButton} 
                    onClick={() => handleDeleteRule(rule.id)}
                    disabled={showForm}
                  >
                    <IconTrash size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Rule Form */}
          {showForm && (
            <form className={styles.ruleForm} onSubmit={handleSubmit}>
              <h4>{editingRule ? 'Edit Rule' : 'Add Rule'}</h4>
              
              <div className={styles.formField}>
                <label htmlFor="name">Name:</label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  placeholder="e.g., title, price, description"
                  required
                />
              </div>
              
              <div className={styles.formField}>
                <label htmlFor="selector">CSS Selector:</label>
                <input
                  type="text"
                  id="selector"
                  name="selector"
                  value={formData.selector}
                  onChange={handleChange}
                  placeholder="e.g., h1, .price, #description"
                  required
                />
              </div>
              
              <div className={styles.formField}>
                <label htmlFor="target">Target:</label>
                <select
                  id="target"
                  name="target"
                  value={formData.target}
                  onChange={handleChange}
                >
                  <option value="text">Text</option>
                  <option value="html">HTML</option>
                  <option value="attribute">Attribute</option>
                </select>
              </div>
              
              {formData.target === 'attribute' && (
                <div className={styles.formField}>
                  <label htmlFor="attribute_name">Attribute Name:</label>
                  <input
                    type="text"
                    id="attribute_name"
                    name="attribute_name"
                    value={formData.attribute_name || ''}
                    onChange={handleChange}
                    placeholder="e.g., href, src, data-id"
                    required
                  />
                </div>
              )}
              
              <div className={styles.formField}>
                <label className={styles.checkboxLabel}>
                  <input
                    type="checkbox"
                    name="multiple"
                    checked={formData.multiple}
                    onChange={handleChange}
                  />
                  Multiple (extract all matching elements)
                </label>
              </div>
              
              <div className={styles.formActions}>
                <button type="button" className={styles.cancelButton} onClick={cancelForm}>
                  <IconX size={16} /> Cancel
                </button>
                <button type="submit" className={styles.saveButton}>
                  <IconDeviceFloppy size={16} /> {editingRule ? 'Update' : 'Add'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default HtmlParserSettings; 