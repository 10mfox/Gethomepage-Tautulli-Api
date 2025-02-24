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
    <div className="section-spacing">
      <div className="dark-panel">
        <div className="p-4 flex items-center justify-between">
          <div className="relative">
            <input
              type="text"
              placeholder="Search users..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(0);
              }}
              className="input-field w-64"
            />
          </div>
          <div className="flex gap-4">
            <select
              value={pageSize}
              onChange={handlePageSizeChange}
              className="input-field w-40"
            >
              <option value="10">10 per page</option>
              <option value="25">25 per page</option>
              <option value="50">50 per page</option>
              <option value="100">100 per page</option>
            </select>

            <button 
              onClick={refresh}
              className="btn-primary"
              disabled={loading}
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>
      </div>

      <div className="dark-panel">
        <div className="data-table">
          {/* Table Header */}
          <div className="grid grid-cols-2 table-header">
            {formatFields.map(field => (
              <div key={field.id} className="subheader-text capitalize">
                {field.id === 'field' ? 'Status' : field.id}
              </div>
            ))}
          </div>

          {/* Table Body */}
          <div className="divide-y divide-white/5">
            {loading && !users ? (
              <div className="px-4 py-8 text-center text-gray-400">
                <div className="loading-spinner mx-auto mb-4" />
                Loading users...
              </div>
            ) : error ? (
              <div className="px-4 py-8 text-center text-red-400">
                {error}
              </div>
            ) : users?.length === 0 ? (
              <div className="px-4 py-8 text-center text-gray-400">
                No users found
              </div>
            ) : (
              users?.map((user, index) => (
                <div 
                  key={index}
                  className="grid grid-cols-2 table-row"
                >
                  {formatFields.map(field => (
                    <div key={field.id} className="text-white">
                      {user[field.id]}
                    </div>
                  ))}
                </div>
              ))
            )}
          </div>

          {/* Pagination */}
          {!loading && users?.length > 0 && (
            <div className="border-t border-white/5 px-4 py-3 flex items-center justify-between">
              <div className="text-sm text-gray-400">
                Showing {page * pageSize + 1} to {Math.min((page + 1) * pageSize, totalRecords)} of {totalRecords} users
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => handlePageChange(page - 1)}
                  disabled={page === 0}
                  className="btn-secondary !py-1 !px-3 disabled:opacity-50"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  onClick={() => handlePageChange(page + 1)}
                  disabled={page >= totalPages - 1}
                  className="btn-secondary !py-1 !px-3 disabled:opacity-50"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default UserView;