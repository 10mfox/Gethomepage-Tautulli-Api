import React, { useState, useEffect } from 'react';
import { Alert, AlertDescription } from '../ui/alert';

const UserFormatView = ({ onError, onSuccess }) => {
  const [fields, setFields] = useState([]);
  const [selectedFieldIndex, setSelectedFieldIndex] = useState(null);
  const [loading, setLoading] = useState(true);

  const variables = [
    { code: '${friendly_name}', description: 'Display name' },
    { code: '${total_plays}', description: 'Total play count' },
    { code: '${last_played}', description: 'Currently watching/last watched' },
    { code: '${media_type}', description: 'Type of media' },
    { code: '${progress_percent}', description: 'Current progress' },
    { code: '${progress_time}', description: 'Progress timestamp' },
    { code: '${is_watching}', description: 'Current status' },
    { code: '${last_seen_formatted}', description: 'Last activity timestamp' },
    { code: '${stream_container_decision}', description: 'Transcode or Direct Play' }
  ];

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const response = await fetch('/api/users/format-settings');
      if (!response.ok) throw new Error('Failed to fetch settings');
      const data = await response.json();
      
      let initialFields = [];
      const existingField = data.fields?.find(f => f.id === 'field');
      const existingAdditionalField = data.fields?.find(f => f.id === 'additionalfield');

      initialFields.push({
        id: 'field',
        template: existingField?.template || ''
      });

      if (existingAdditionalField) {
        initialFields.push({
          id: 'additionalfield',
          template: existingAdditionalField.template
        });
      }

      setFields(initialFields);
      setLoading(false);
    } catch (error) {
      onError('Failed to load user settings');
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      const response = await fetch('/api/users/format-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fields })
      });

      if (!response.ok) throw new Error('Failed to save settings');
      onSuccess();
    } catch (error) {
      onError('Failed to save settings');
    }
  };

  const toggleAdditionalField = () => {
    setFields(prev => {
      if (prev.some(f => f.id === 'additionalfield')) {
        return prev.filter(f => f.id === 'field');
      }
      return [...prev, { id: 'additionalfield', template: '' }];
    });
  };

  const updateField = (id, template) => {
    setFields(prev => 
      prev.map(field => 
        field.id === id ? { ...field, template } : field
      )
    );
  };

  const textareaRefs = React.useRef({});

  const insertVariable = (code) => {
    if (selectedFieldIndex === null) return;
    
    const field = fields[selectedFieldIndex];
    const textarea = textareaRefs.current[field.id];
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const template = field.template;
    const newTemplate = template.slice(0, start) + code + template.slice(end);
    
    updateField(field.id, newTemplate);

    setTimeout(() => {
      textarea.focus();
      const newPosition = start + code.length;
      textarea.setSelectionRange(newPosition, newPosition);
    }, 0);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center p-8">
        <div className="loading-spinner" />
      </div>
    );
  }

  return (
    <div className="section-spacing">
      <Alert className="alert alert-info">
        <AlertDescription className="flex items-center gap-2">
          Configure how user information is displayed. The 'field' is required, and you can optionally enable an additional field.
        </AlertDescription>
      </Alert>

      <div className="dark-panel">
        <div className="table-header flex items-center justify-between">
          <h3 className="header-text">User Display Fields</h3>
          <button
            onClick={toggleAdditionalField}
            className={fields.some(f => f.id === 'additionalfield') ? 'btn-secondary' : 'btn-primary'}
          >
            {fields.some(f => f.id === 'additionalfield') ? 'Remove Additional Field' : 'Add Additional Field'}
          </button>
        </div>

        <div className="p-4 space-y-6">
          {fields.map((field, index) => (
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
                  onChange={(e) => updateField(field.id, e.target.value)}
                  onFocus={() => setSelectedFieldIndex(index)}
                  ref={(el) => textareaRefs.current[field.id] = el}
                  className="input-field min-h-[60px]"
                  placeholder="Enter display format template"
                />
              </div>

              <div className="bg-black/20 rounded-lg p-4">
                <h5 className="subheader-text mb-3">Available Variables (click to add):</h5>
                <div className="grid grid-cols-2 gap-2">
                  {variables.map(({ code, description }) => (
                    <button
                      key={code}
                      onClick={() => insertVariable(code)}
                      className="text-left text-sm p-2 hover:bg-white/5 rounded transition-colors flex items-center gap-2"
                      disabled={selectedFieldIndex !== index}
                    >
                      <code className="text-theme-accent">{code}</code>
                      <span className="text-gray-400">- {description}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ))}

          <button onClick={handleSave} className="btn-primary w-full mt-6">
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
};

export default UserFormatView;