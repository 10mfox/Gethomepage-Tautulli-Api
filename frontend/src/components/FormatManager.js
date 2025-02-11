import React, { useState, useEffect } from 'react';
import { Users, Film, Layout } from 'lucide-react';
import { Alert, AlertDescription } from './ui/alert';
import UserFormatView from './managers/UserFormatView';
import MediaFormatView from './managers/MediaFormatView';
import SectionManager from './managers/SectionManager';

const FormatManager = () => {
  const [activeView, setActiveView] = useState('user');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const tabs = [
    { id: 'user', label: 'User Display', icon: Users },
    { id: 'media', label: 'Media Display', icon: Film },
    { id: 'sections', label: 'Section Manager', icon: Layout }
  ];

  const handleError = (message) => {
    setError(message);
    setSuccess(false);
  };

  const handleSuccess = () => {
    setError('');
    setSuccess(true);
    setTimeout(() => setSuccess(false), 3000);
  };

  return (
    <div className="p-4 max-w-5xl mx-auto">
      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert className="mb-4">
          <AlertDescription>Settings saved successfully</AlertDescription>
        </Alert>
      )}

      <div className="bg-gray-800 border border-gray-700 rounded-lg overflow-hidden">
        <div className="border-b border-gray-700">
          <div className="flex">
            {tabs.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setActiveView(id)}
                className={`flex items-center gap-2 px-6 py-3 text-sm font-medium ${
                  activeView === id
                    ? 'bg-gray-700 text-white'
                    : 'text-gray-400 hover:text-white hover:bg-gray-700'
                }`}
              >
                <Icon className="h-4 w-4" />
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="p-6">
          {activeView === 'user' && (
            <UserFormatView onError={handleError} onSuccess={handleSuccess} />
          )}
          {activeView === 'media' && (
            <MediaFormatView onError={handleError} onSuccess={handleSuccess} />
          )}
          {activeView === 'sections' && (
            <SectionManager onError={handleError} onSuccess={handleSuccess} />
          )}
        </div>
      </div>
    </div>
  );
};

export default FormatManager;