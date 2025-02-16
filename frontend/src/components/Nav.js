import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Settings } from 'lucide-react';

const Nav = () => {
  const location = useLocation();

  const routes = [
    {
      path: '/',
      label: 'Dashboard',
      icon: LayoutDashboard
    },
    {
      path: '/format',
      label: 'Format Settings',
      icon: Settings
    }
  ];

  return (
    <nav className="bg-gray-800 border-b border-gray-700">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center">
            <Link to="/" className="flex items-center">
              <span className="text-xl font-bold text-white">
                Tautulli Manager
              </span>
            </Link>
          </div>

          <div className="flex space-x-4">
            {routes.map(({ path, label, icon: Icon }) => (
              <Link
                key={path}
                to={path}
                className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium ${
                  location.pathname === path
                    ? 'bg-gray-900 text-white'
                    : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                }`}
              >
                <Icon className="h-4 w-4" />
                {label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Nav;