/**
 * User Format Manager component
 * Handles configuration of user display formats
 * @module components/managers/UserFormatManager
 */
import React from 'react';
import { variables } from '../../utils/utils';

/**
 * User format configuration component
 * 
 * @param {Object} props - Component props
 * @param {Array} props.userFields - User format fields
 * @param {Function} props.setUserFields - Function to update user fields
 * @param {number|null} props.selectedFieldIndex - Currently selected field index
 * @param {Function} props.setSelectedFieldIndex - Function to update selected field index
 * @param {Object} props.textareaRefs - Refs for textarea elements
 * @param {Function} props.insertVariable - Function to insert variable at cursor position
 * @returns {JSX.Element} Rendered component
 */
const UserFormatManager = ({ 
  userFields, 
  setUserFields, 
  selectedFieldIndex, 
  setSelectedFieldIndex,
  textareaRefs,
  insertVariable
}) => {
  /**
   * Toggle additional field for user formats
   */
  const toggleUserAdditionalField = () => {
    setUserFields(prev => {
      if (prev.some(f => f.id === 'additionalfield')) {
        return prev.filter(f => f.id !== 'additionalfield');
      }
      return [...prev, { id: 'additionalfield', template: '' }];
    });
  };

  /**
   * Update user format field
   * 
   * @param {string} id - Field ID
   * @param {string} template - New template value
   */
  const updateUserField = (id, template) => {
    setUserFields(prev => 
      prev.map(field => 
        field.id === id ? { ...field, template } : field
      )
    );
  };

  /**
   * Renders the template variable selection panel
   * 
   * @returns {JSX.Element} Variable selection panel
   */
  const renderVariablePanel = () => {
    const variablesToUse = variables.user;
    
    return (
      <div className="dark-panel">
        <div className="table-header">
          <h3 className="header-text">Available Variables</h3>
        </div>
        <div className="p-4 bg-black/20 rounded-lg">
          <div className="description-text mb-3">
            Click on a variable to insert it at the cursor position:
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {variablesToUse.map(({ code, description }) => (
              <button
                key={code}
                onClick={() => insertVariable(code)}
                disabled={selectedFieldIndex === null}
                className="text-left text-sm p-2 hover:bg-white/5 rounded transition-colors flex items-center gap-2"
              >
                <code className="text-theme-accent">{code}</code>
                <span className="text-gray-400">- {description}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="dark-panel">
        <div className="table-header flex items-center justify-between">
          <h3 className="header-text">User Display Format</h3>
          <button
            onClick={toggleUserAdditionalField}
            className={userFields.some(f => f.id === 'additionalfield') ? 'btn-secondary' : 'btn-primary'}
          >
            {userFields.some(f => f.id === 'additionalfield') ? 'Remove Additional Field' : 'Add Additional Field'}
          </button>
        </div>
        <div className="p-4 space-y-6">
          {userFields.map((field, index) => (
            <div key={field.id} className="dark-panel p-4 space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="subheader-text capitalize">
                  {field.id === 'field' ? 'Primary Field' : 'Additional Field'}
                </h4>
              </div>
              <div className="space-y-2">
                <label className="form-label">Display Format</label>
                <textarea
                  value={field.template}
                  onChange={(e) => updateUserField(field.id, e.target.value)}
                  onFocus={() => {
                    setSelectedFieldIndex(index);
                  }}
                  ref={(el) => textareaRefs.current[`user-${field.id}`] = el}
                  className="input-field min-h-[60px]"
                  placeholder="Enter display format template"
                />
              </div>
            </div>
          ))}
        </div>
      </div>
      {renderVariablePanel()}
    </div>
  );
};

export default UserFormatManager;