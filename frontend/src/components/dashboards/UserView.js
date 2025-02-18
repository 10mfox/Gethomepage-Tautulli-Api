import React, { useState, useEffect } from 'react';
import { RefreshCw, ChevronLeft, ChevronRight } from 'lucide-react';
import { useBackgroundRefresh } from '../../hooks/useBackgroundRefresh';

const UserView = () => {
  const [formatFields, setFormatFields] = useState([]);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(25);
  const [totalRecords, setTotalRecords] = useState(0);

  const fetchUsers = async () => {
    const [usersResponse, formatResponse] = await Promise.all([
      fetch(`/api/users?start=${page * pageSize}&length=${pageSize}&search=${search}`),
      fetch('/api/users/format-settings')
    ]);
    
    if (!usersResponse.ok || !formatResponse.ok) {
      throw new Error('Failed to fetch data');
    }
    
    const userData = await usersResponse.json();
    const formatData = await formatResponse.json();
    
    setFormatFields(formatData.fields || []);
    setTotalRecords(userData.response?.recordsTotal || 0);
    
    return userData.response?.data || [];
  };

  const { 
    data: users, 
    loading, 
    error, 
    lastUpdated, 
    refresh 
  } = useBackgroundRefresh(fetchUsers);

  const totalPages = Math.ceil(totalRecords / pageSize);

  const handlePageChange = (newPage) => {
    setPage(Math.max(0, Math.min(newPage, totalPages - 1)));
  };

  const handlePageSizeChange = (event) => {
    const newSize = parseInt(event.target.value);
    setPageSize(newSize);
    setPage(0);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between bg-gray-800 border border-gray-700 p-4 rounded-lg">
        <div className="flex gap-2 items-center">
          <input
            type="text"
            placeholder="Search users..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(0);
            }}
            className="w-64 px-3 py-2 bg-gray-900 border border-gray-700 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-white"
          />
          <button 
            onClick={refresh}
            className="p-2 rounded hover:bg-gray-700 text-gray-300 relative group"
            title="Refresh"
          >
            <RefreshCw className="h-4 w-4" />
            {lastUpdated && (
              <span className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 text-xs bg-gray-900 text-gray-300 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                Last updated: {lastUpdated.toLocaleTimeString()}
              </span>
            )}
          </button>
        </div>

        <div className="flex items-center gap-4">
          <select
            value={pageSize}
            onChange={handlePageSizeChange}
            className="bg-gray-900 border border-gray-700 rounded px-2 py-1 text-sm min-w-[140px]"
          >
            <option value="10">10 per page</option>
            <option value="25">25 per page</option>
            <option value="50">50 per page</option>
            <option value="100">100 per page</option>
          </select>

          <div className="flex items-center gap-2">
            <button
              onClick={() => handlePageChange(page - 1)}
              disabled={page === 0}
              className={`p-1 rounded ${page === 0 ? 'text-gray-600' : 'hover:bg-gray-700 text-gray-300'}`}
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <span className="text-sm text-gray-400">
              Page {page + 1} of {Math.max(1, totalPages)}
            </span>
            <button
              onClick={() => handlePageChange(page + 1)}
              disabled={page >= totalPages - 1}
              className={`p-1 rounded ${page >= totalPages - 1 ? 'text-gray-600' : 'hover:bg-gray-700 text-gray-300'}`}
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
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
              {loading && !users ? (
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
              ) : users?.length === 0 ? (
                <tr>
                  <td colSpan={formatFields.length} className="text-center py-8 text-gray-400">
                    No users found
                  </td>
                </tr>
              ) : (
                users?.map((user, index) => (
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

        {!loading && users?.length > 0 && (
          <div className="p-4 border-t border-gray-700 text-sm text-gray-400">
            Showing {page * pageSize + 1} to {Math.min((page + 1) * pageSize, totalRecords)} of {totalRecords} users
          </div>
        )}
      </div>
    </div>
  );
};

export default UserView;