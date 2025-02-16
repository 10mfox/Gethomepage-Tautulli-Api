import React, { useState, useEffect } from 'react';
import { AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '../ui/alert';

const UserFormatView = ({ onError, onSuccess }) => {
  const [fields, setFields] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedFieldIndex, setSelectedFieldIndex] = useState(null);

  const variables = [
    { code: '${friendly_name}', description: 'Display name' },
    { code: '${total_plays}', description: 'Total play count' },
    { code: '${last_played}', description: 'Currently watching/last watched' },
    { code: '${last_played_modified}', description: 'Modified version of currently watching/last watched' },
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
      
      // Initialize fields with default structure
      let initialFields = [];
      const existingField = data.fields?.find(f => f.id === 'field');
      const existingAdditionalField = data.fields?.find(f => f.id === 'additionalfield');

      // Always include 'field'
      initialFields.push({
        id: 'field',
        template: existingField?.template || ''
      });

      // Include 'additionalfield' if it exists
      if (existingAdditionalField) {
        initialFields.push({
          id: 'additionalfield',
          template: existingAdditionalField.template
        });
      }

      setFields(initialFields);
      setLoading(false);
    } catch (error) {
      console.error('Failed to load settings:', error);
      onError('Failed to load user settings');
      setLoading(false);
    }
  };

  const toggleAdditionalField = () => {
    setFields(prevFields => {
      if (prevFields.some(f => f.id === 'additionalfield')) {
        // Remove additionalfield
        return prevFields.filter(f => f.id === 'field');
      } else {
        // Add additionalfield
        return [...prevFields, { id: 'additionalfield', template: '' }];
      }
    });
  };

  const updateField = (id, template) => {
    setFields(prevFields => 
      prevFields.map(field => 
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
      console.error('Save error:', error);
      onError('Failed to save user settings');
    }
  };

  if (loading) {
    return <div className="text-center text-gray-400">Loading settings...</div>;
  }

  const hasAdditionalField = fields.some(f => f.id === 'additionalfield');

  return (
    <div className="space-y-8">
      <Alert className="bg-blue-900/50 border-blue-800">
        <AlertDescription className="flex items-center gap-2 text-blue-100">
          <AlertCircle className="h-4 w-4" />
          Configure how user information is displayed. The 'field' is required, and you can optionally enable an additional field.
        </AlertDescription>
      </Alert>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-white">
            User Display Fields
          </h3>
          <button
            onClick={toggleAdditionalField}
            className={`px-3 py-1 text-sm rounded transition-colors ${
              hasAdditionalField
                ? 'bg-red-600 hover:bg-red-700 text-white'
                : 'bg-blue-600 hover:bg-blue-700 text-white'
            }`}
          >
            {hasAdditionalField ? 'Remove Additional Field' : 'Add Additional Field'}
          </button>
        </div>

        {fields.map((field, index) => (
          <div key={field.id} className="p-4 bg-gray-700 rounded-lg space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium text-white capitalize">
                {field.id === 'field' ? 'Primary Field' : 'Additional Field'}
              </h4>
            </div>

            <div className="space-y-2">
              <label className="block text-sm text-gray-300">Display Format</label>
              <textarea
                value={field.template}
                onChange={(e) => updateField(field.id, e.target.value)}
                onFocus={() => setSelectedFieldIndex(index)}
                ref={(el) => textareaRefs.current[field.id] = el}
                className="w-full p-2 bg-gray-800 border border-gray-600 rounded min-h-[60px]"
                placeholder="Enter display format template"
              />
            </div>

            <div className="mt-4 p-3 bg-gray-800 rounded">
              <p className="text-sm font-medium text-gray-300 mb-2">Available Variables (click to add):</p>
              <div className="grid grid-cols-2 gap-2">
                {variables.map(({ code, description }) => (
                  <button
                    key={code}
                    onClick={() => insertVariable(code)}
                    className="text-left text-sm p-1 hover:bg-gray-700 rounded transition-colors"
                    disabled={selectedFieldIndex !== index}
                  >
                    <code className="text-blue-300">{code}</code>
                    <span className="text-gray-400 ml-2">- {description}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>

      <button
        onClick={handleSave}
        className="w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
      >
        Save Changes
      </button>
    </div>
  );
};

export default UserFormatView;