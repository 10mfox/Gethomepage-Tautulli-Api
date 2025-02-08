import React, { useState, useEffect } from 'react';
import { RefreshCw } from 'lucide-react';

const UserView = () => {
  const [users, setUsers] = useState([]);
  const [formatFields, setFormatFields] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [usersResponse, formatResponse] = await Promise.all([
        fetch('/api/users'),
        fetch('/api/users/format-settings')
      ]);
      
      if (!usersResponse.ok || !formatResponse.ok) throw new Error('Failed to fetch data');
      
      const userData = await usersResponse.json();
      const formatData = await formatResponse.json();
      
      setUsers(userData.response?.data || []);
      setFormatFields(formatData.fields || []);
    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const filteredUsers = users.filter(user => {
    const searchTerm = search.toLowerCase();
    return Object.values(user).some(value => 
      String(value).toLowerCase().includes(searchTerm)
    );
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between bg-gray-800 border border-gray-700 p-4 rounded-lg">
        <div className="flex gap-2 items-center">
          <input
            type="text"
            placeholder="Search users..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-64 px-3 py-2 bg-gray-900 border border-gray-700 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-white"
          />
          <button 
            onClick={fetchData}
            className="p-2 rounded hover:bg-gray-700 text-gray-300"
            title="Refresh"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="bg-gray-800 border border-gray-700 rounded-lg">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-700">
                {formatFields.map(field => (
                  <th key={field.id} className="p-4 text-left text-gray-300">
                    {field.id}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={formatFields.length} className="text-center py-8 text-gray-400">
                    Loading users...
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={formatFields.length} className="text-center py-8 text-red-400">
                    {error}
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={formatFields.length} className="text-center py-8 text-gray-400">
                    No users found
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user, index) => (
                  <tr key={index} className="border-b border-gray-700 hover:bg-gray-700">
                    {formatFields.map(field => (
                      <td key={field.id} className="p-4 text-gray-300">
                        {user[field.id]}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default UserView;