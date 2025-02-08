import React, { useState, useEffect } from 'react';
import { Plus, Trash2 } from 'lucide-react';

const UserFormatView = ({ onError, onSuccess }) => {
  const [fields, setFields] = useState([
    { id: 'name', template: '${friendly_name} ${last_seen_formatted}' },
    { id: 'watched', template: '${is_watching} - ${media_type} ( ${last_played} ) ${progress_time}' },
    { id: 'test', template: '${total_plays}' }
  ]);

  const fetchSettings = async () => {
    try {
      const response = await fetch('/api/users/format-settings');
      if (!response.ok) throw new Error('Failed to fetch settings');
      const data = await response.json();
      setFields(data.fields || []);
    } catch (error) {
      onError('Failed to load settings');
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleSave = async () => {
    try {
      const response = await fetch('/api/users/format-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fields })
      });

      if (!response.ok) throw new Error('Failed to save settings');
      const data = await response.json();
      if (data.success) {
        onSuccess();
      } else {
        throw new Error('Failed to save settings');
      }
    } catch (error) {
      onError('Failed to save settings');
    }
  };

  const handleAddField = () => {
    setFields([...fields, { id: '', template: '' }]);
  };

  const handleRemoveField = (index) => {
    setFields(fields.filter((_, i) => i !== index));
  };

  const handleFieldChange = (index, key, value) => {
    const newFields = [...fields];
    newFields[index] = { ...newFields[index], [key]: value };
    setFields(newFields);
  };

  const variables = [
    ['${friendly_name}', 'Display name'],
    ['${progress_time}', 'Progress timestamp'],
    ['${last_played}', 'Currently watching/last watched'],
    ['${total_plays}', 'Total play count'],
    ['${media_type}', 'Type of media'],
    ['${is_watching}', 'Current status'],
    ['${progress_percent}', 'Current progress'],
    ['${last_seen_formatted}', 'Last activity timestamp']
  ];

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        {fields.map((field, index) => (
          <div key={index} className="flex gap-3 bg-gray-700/50 rounded-lg">
            <input
              type="text"
              value={field.id}
              onChange={(e) => handleFieldChange(index, 'id', e.target.value)}
              className="flex-1 p-3 bg-gray-900 rounded-l border-0 text-white"
              placeholder="Field Name"
            />
            <input
              type="text"
              value={field.template}
              onChange={(e) => handleFieldChange(index, 'template', e.target.value)}
              className="flex-[2] p-3 bg-gray-900 border-0 text-white"
              placeholder="Template"
            />
            <button
              onClick={() => handleRemoveField(index)}
              className="px-4 text-red-400 hover:text-red-300 flex items-center"
            >
              <Trash2 className="h-5 w-5" />
            </button>
          </div>
        ))}

        <button
          onClick={handleAddField}
          className="text-blue-400 hover:text-blue-300 flex items-center gap-2"
        >
          <Plus className="h-4 w-4" />
          Add Field
        </button>
      </div>

      <div>
        <h3 className="text-xl font-semibold text-white mb-4">Available Variables</h3>
        <div className="grid grid-cols-2 gap-4">
          {variables.map(([variable, desc]) => (
            <div key={variable} className="flex items-center gap-2">
              <code className="bg-gray-900 px-2 py-1 rounded text-blue-400 font-mono">
                {variable}
              </code>
              <span className="text-gray-400">{desc}</span>
            </div>
          ))}
        </div>
      </div>

      <button
        onClick={handleSave}
        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
      >
        Save Changes
      </button>
    </div>
  );
};

export default UserFormatView;