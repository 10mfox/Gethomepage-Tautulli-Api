import React, { useState } from 'react';
import UserView from './dashboards/UserView';
import RecentMediaView from './dashboards/RecentMediaView';
import LibraryView from './dashboards/LibraryView';

const Dashboard = () => {
  const [activeTab, setActiveTab] = useState('users');

  const tabs = [
    { 
      id: 'users', 
      label: 'Users', 
      icon: '👤',
      component: UserView 
    },
    { 
      id: 'recent', 
      label: 'Recent Media', 
      icon: '🎬',
      component: RecentMediaView 
    },
    { 
      id: 'libraries', 
      label: 'Libraries', 
      icon: '📚',
      component: LibraryView 
    }
  ];

  const ActiveComponent = tabs.find(tab => tab.id === activeTab)?.component || UserView;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-8 border-b border-white/5">
        {tabs.map(({ id, label, icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`flex items-center gap-2 pb-4 text-sm font-medium -mb-px transition-colors ${
              activeTab === id
                ? 'text-blue-400 border-b-2 border-blue-400'
                : 'text-gray-400 hover:text-gray-300'
            }`}
          >
            <span className="text-lg">{icon}</span>
            <span>{label}</span>
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