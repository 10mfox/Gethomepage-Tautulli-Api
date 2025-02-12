// frontend/src/components/Dashboard.js
import React, { useState } from 'react';
import { Users, Film, Library } from 'lucide-react';
import UserView from './dashboards/UserView';
import RecentMediaView from './dashboards/RecentMediaView';
import LibraryView from './dashboards/LibraryView';

const Dashboard = () => {
  const [activeTab, setActiveTab] = useState('users');

  const tabs = [
    { id: 'users', label: 'Users', icon: Users, component: UserView },
    { id: 'recent', label: 'Recent Media', icon: Film, component: RecentMediaView },
    { id: 'libraries', label: 'Libraries', icon: Library, component: LibraryView }
  ];

  const ActiveComponent = tabs.find(tab => tab.id === activeTab)?.component || UserView;

  return (
    <div className="p-4 space-y-4">
      <div className="flex border-b border-gray-700">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`flex items-center gap-2 px-4 py-2 -mb-px text-sm font-medium transition-colors ${
              activeTab === id
                ? 'text-blue-400 border-b-2 border-blue-400'
                : 'text-gray-400 hover:text-gray-300'
            }`}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      <div>
        <ActiveComponent />
      </div>
    </div>
  );
};

export default Dashboard;