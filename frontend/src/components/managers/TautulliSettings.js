import React, { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

const TautulliSettings = ({ 
  envVars, 
  onEnvVarsChange, 
  onTestConnection, 
  onSaveConnection,
  testStatus,
  savingConnection,
  className = "" 
}) => {
  const [showApiKey, setShowApiKey] = useState(false);

  return (
    <div className={`bg-gray-800 border border-gray-700 rounded-lg p-6 space-y-6 ${className}`}>
      <h3 className="text-lg font-semibold text-white">
        Tautulli Connection
      </h3>

      <div className="grid gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">
            Tautulli Base URL
          </label>
          <input
            type="url"
            value={envVars.TAUTULLI_BASE_URL}
            onChange={(e) => onEnvVarsChange({
              ...envVars,
              TAUTULLI_BASE_URL: e.target.value
            })}
            placeholder="http://localhost:8181"
            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white placeholder-gray-400"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">
            Tautulli API Key
          </label>
          <div className="relative">
            <input
              type={showApiKey ? "text" : "password"}
              value={envVars.TAUTULLI_API_KEY}
              onChange={(e) => onEnvVarsChange({
                ...envVars,
                TAUTULLI_API_KEY: e.target.value
              })}
              placeholder="Your Tautulli API key"
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white placeholder-gray-400 pr-10"
            />
            <button
              type="button"
              onClick={() => setShowApiKey(!showApiKey)}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-white"
            >
              {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={onTestConnection}
            disabled={testStatus === 'testing'}
            className={`px-4 py-2 rounded text-white ${
              testStatus === 'success' ? 'bg-green-600' :
              testStatus === 'error' ? 'bg-red-600' :
              testStatus === 'testing' ? 'bg-gray-600' :
              'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            {testStatus === 'success' ? 'Connection Successful!' :
             testStatus === 'error' ? 'Connection Failed' :
             testStatus === 'testing' ? 'Testing...' :
             'Test Connection'}
          </button>
          <button
            onClick={onSaveConnection}
            disabled={savingConnection}
            className={`px-4 py-2 rounded text-white bg-blue-600 hover:bg-blue-700 ${
              savingConnection ? 'opacity-50 cursor-not-allowed' : ''
            }`}
          >
            {savingConnection ? 'Saving...' : 'Save Connection'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default TautulliSettings;