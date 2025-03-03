/**
 * User Activity dashboard component
 * Displays user activity with pagination and search
 * @module components/dashboard/UserView
 */
import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useBackgroundRefresh } from '../../hooks/useBackgroundRefresh';

/**
 * This dashboard automatically refreshes data based on the server-configured interval
 * No refresh button is needed as data is updated in the background
 * Default refresh interval: 60 seconds (configurable via TAUTULLI_REFRESH_INTERVAL)
 */

/**
 * User Activity dashboard component
 * 
 * @returns {JSX.Element} Rendered component
 */
const UserView = () => {
  /**
   * Format fields to display
   * @type {[Array, Function]}
   */
  const [formatFields, setFormatFields] = useState([]);
  
  /**
   * Search query for filtering users
   * @type {[string, Function]}
   */
  const [search, setSearch] = useState('');
  
  /**
   * Current page number (zero-based)
   * @type {[number, Function]}
   */
  const [page, setPage] = useState(0);
  
  /**
   * Number of items per page
   * @type {[number, Function]}
   */
  const [pageSize, setPageSize] = useState(25);
  
  /**
   * Total number of records
   * @type {[number, Function]}
   */
  const [totalRecords, setTotalRecords] = useState(0);
  
  /**
   * Server refresh interval
   * @type {[number, Function]}
   */
  const [refreshInterval, setRefreshInterval] = useState(60000);

  /**
   * Fetch configuration when component mounts
   */
  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const response = await fetch('/api/config', {
          headers: {
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache'
          }
        });
        const data = await response.json();
        if (data.refreshInterval) {
          console.log(`Setting refresh interval to ${data.refreshInterval}ms`);
          setRefreshInterval(data.refreshInterval);
        }
      } catch (error) {
        console.error('Error fetching configuration:', error);
      }
    };
    
    fetchConfig();
  }, []);

  /**
   * Fetches user data from the API
   * 
   * @async
   * @returns {Promise<Array>} Array of user objects
   */
  const fetchUsers = async () => {
    try {
      console.log('Fetching user data...');
      const [usersResponse, formatResponse] = await Promise.all([
        fetch(`/api/users?start=${page * pageSize}&length=${pageSize}&search=${search}`, {
          headers: {
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache'
          }
        }),
        fetch('/api/users/format-settings', {
          headers: {
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache'
          }
        })
      ]);
      
      if (!usersResponse.ok || !formatResponse.ok) {
        throw new Error('Failed to fetch data');
      }
      
      const userData = await usersResponse.json();
      const formatData = await formatResponse.json();
      
      // Ensure consistent field IDs
      const fields = formatData.fields || [];
      if (fields.length > 0 && fields[0].id !== 'field') {
        fields[0].id = 'field';
      }
      
      setFormatFields(fields);
      setTotalRecords(userData.response?.recordsTotal || 0);
      
      console.log(`Fetched ${userData.response?.data?.length || 0} users`);
      
      return userData.response?.data || [];
    } catch (error) {
      console.error('Error fetching user data:', error);
      throw error;
    }
  };

  /**
   * Background refresh hook for user data
   */
  const { 
    data: users, 
    loading, 
    error,
    refresh
  } = useBackgroundRefresh(fetchUsers, refreshInterval);
  
  /**
   * Set up a timer to force refresh data periodically
   * This ensures we always have the latest data
   */
  useEffect(() => {
    console.log(`Setting up manual refresh timer (${refreshInterval}ms)`);
    
    // Force refresh immediately on mount
    refresh();
    
    // Set up a timer to force refresh data
    const refreshTimer = setInterval(() => {
      console.log('Manual refresh timer triggered');
      refresh();
    }, refreshInterval);
    
    return () => {
      console.log('Cleaning up manual refresh timer');
      clearInterval(refreshTimer);
    };
  }, [refresh, refreshInterval]);

  /**
   * Force refresh when pagination or search changes
   */
  useEffect(() => {
    console.log(`Page or search changed: page=${page}, search=${search}`);
    refresh();
  }, [page, pageSize, search, refresh]);

  const totalPages = Math.ceil(totalRecords / pageSize);

  /**
   * Handle page change
   * 
   * @param {number} newPage - New page number
   */
  const handlePageChange = (newPage) => {
    setPage(Math.max(0, Math.min(newPage, totalPages - 1)));
  };

  /**
   * Handle page size change
   * 
   * @param {Object} event - Change event
   */
  const handlePageSizeChange = (event) => {
    const newSize = parseInt(event.target.value);
    setPageSize(newSize);
    setPage(0);
  };

  /**
   * Get a user-friendly field name for display
   * 
   * @param {Object} field - Field object
   * @param {number} index - Field index
   * @returns {string} User-friendly field name
   */
  const getFieldDisplayName = (field, index) => {
    if (field.id === 'field' || index === 0) {
      return 'Primary Field';
    } else if (field.id === 'additionalfield') {
      return 'Additional Field';
    }
    // Handle any other fields by capitalizing the field ID
    return field.id.charAt(0).toUpperCase() + field.id.slice(1);
  };

  /**
   * Get the correct field key to access user data
   * 
   * @param {Object} field - Field object
   * @param {number} index - Field index
   * @returns {string} Field key to access user data
   */
  const getFieldKey = (field, index) => {
    // First field should always use 'field' as the key
    return index === 0 ? 'field' : field.id;
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
          <div className="flex gap-4 items-center">
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
            <div className="text-xs text-gray-400">
              Auto-refreshes every {Math.round(refreshInterval/1000)} seconds
            </div>
          </div>
        </div>
      </div>

      <div className="dark-panel">
        <div className="data-table">
          {/* Table Header */}
          <div className="grid grid-cols-2 table-header">
            {formatFields.map((field, index) => (
              <div key={field.id} className="subheader-text capitalize">
                {getFieldDisplayName(field, index)}
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
                {error.message || String(error)}
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
                  {formatFields.map((field, fieldIndex) => {
                    const fieldKey = getFieldKey(field, fieldIndex);
                    return (
                      <div key={field.id} className="text-white">
                        {user[fieldKey] || ''}
                      </div>
                    );
                  })}
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