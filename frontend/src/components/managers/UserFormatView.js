import React, { useState, useEffect } from 'react';
import { Plus, Trash2 } from 'lucide-react';

const UserFormatView = ({ onError, onSuccess }) => {
  const [fields, setFields] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const response = await fetch('/api/users/format-settings');
      if (!response.ok) throw new Error('Failed to fetch settings');
      const data = await response.json();
      setFields(data.fields || []);
      setLoading(false);
    } catch (error) {
      console.error('Failed to load settings:', error);
      onError('Failed to load user settings');
      setLoading(false);
    }
  };

  const addField = () => {
    setFields([...fields, { id: '', template: '' }]);
  };

  const removeField = (index) => {
    setFields(fields.filter((_, i) => i !== index));
  };

  const updateField = (index, key, value) => {
    const newFields = [...fields];
    newFields[index] = { ...newFields[index], [key]: value };
    setFields(newFields);
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
      await fetchSettings();
    } catch (error) {
      console.error('Save error:', error);
      onError('Failed to save user settings');
    }
  };

  if (loading) {
    return <div className="text-center text-gray-400">Loading settings...</div>;
  }

  return (
    <div className="space-y-8">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-white">
            User Display Fields
          </h3>
          <button
            onClick={addField}
            className="flex items-center gap-2 px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            <Plus className="h-4 w-4" />
            Add Field
          </button>
        </div>

        {fields.length === 0 ? (
          <div className="p-4 text-center text-gray-400 border border-gray-700 rounded-lg">
            No display fields configured. Click "Add Field" to begin.
          </div>
        ) : (
          fields.map((field, index) => (
            <div key={index} className="p-4 bg-gray-700 rounded-lg space-y-4">
              <div className="flex items-center gap-4">
                <input
                  type="text"
                  value={field.id}
                  onChange={(e) => updateField(index, 'id', e.target.value)}
                  className="flex-1 p-2 bg-gray-800 border border-gray-600 rounded"
                  placeholder="Field Name"
                />
                <button
                  onClick={() => removeField(index)}
                  className="p-2 text-red-400 hover:text-red-300"
                  title="Remove Field"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>

              <div className="space-y-2">
                <label className="block text-sm text-gray-300">Display Format</label>
                <input
                  value={field.template}
                  onChange={(e) => updateField(index, 'template', e.target.value)}
                  className="w-full p-2 bg-gray-800 border border-gray-600 rounded"
                  placeholder="Enter display format template"
                />
              </div>

              <div className="mt-4 p-3 bg-gray-800 rounded">
                <p className="text-sm font-medium text-gray-300 mb-2">Available Variables:</p>
                <div className="grid grid-cols-2 gap-2">
                  <div className="text-sm">
                    <code className="text-blue-300">${'{friendly_name}'}</code>
                    <span className="text-gray-400 ml-2">- Display name</span>
                  </div>
                  <div className="text-sm">
                    <code className="text-blue-300">${'{total_plays}'}</code>
                    <span className="text-gray-400 ml-2">- Total play count</span>
                  </div>
                  <div className="text-sm">
                    <code className="text-blue-300">${'{last_played}'}</code>
                    <span className="text-gray-400 ml-2">- Currently watching/last watched</span>
                  </div>
                  <div className="text-sm">
                    <code className="text-blue-300">${'{media_type}'}</code>
                    <span className="text-gray-400 ml-2">- Type of media</span>
                  </div>
                  <div className="text-sm">
                    <code className="text-blue-300">${'{progress_percent}'}</code>
                    <span className="text-gray-400 ml-2">- Current progress</span>
                  </div>
                  <div className="text-sm">
                    <code className="text-blue-300">${'{progress_time}'}</code>
                    <span className="text-gray-400 ml-2">- Progress timestamp</span>
                  </div>
                  <div className="text-sm">
                    <code className="text-blue-300">${'{is_watching}'}</code>
                    <span className="text-gray-400 ml-2">- Current status</span>
                  </div>
                  <div className="text-sm">
                    <code className="text-blue-300">${'{last_seen_formatted}'}</code>
                    <span className="text-gray-400 ml-2">- Last activity timestamp</span>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
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