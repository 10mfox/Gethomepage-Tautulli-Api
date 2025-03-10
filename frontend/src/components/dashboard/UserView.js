/**
 * User Activity dashboard component
 * Displays user activity with pagination and search
 * @module components/dashboard/UserView
 */
import React, { useState, useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react';

/**
 * User Activity dashboard component with optimized refresh strategy
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
   * User data state
   * @type {[Array, Function]}
   */
  const [users, setUsers] = useState(null);
  
  /**
   * Loading state
   * @type {[boolean, Function]}
   */
  const [loading, setLoading] = useState(true);
  
  /**
   * Error state
   * @type {[string|null, Function]}
   */
  const [error, setError] = useState(null);
  
  /**
   * Search query for filtering users
   * @type {[string, Function]}
   */
  const [search, setSearch] = useState('');
  
  /**
   * Cached search query to detect actual changes
   * @type {[string, Function]}
   */
  const [debouncedSearch, setDebouncedSearch] = useState('');
  
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
   * Timestamp of last data update
   * @type {React.MutableRefObject<number>}
   */
  const lastUpdatedRef = useRef(0);
  
  /**
   * Timer reference for refresh interval
   * @type {React.MutableRefObject<NodeJS.Timeout|null>}
   */
  const timerRef = useRef(null);
  
  /**
   * Flag to check if component is mounted
   * @type {React.MutableRefObject<boolean>}
   */
  const isMountedRef = useRef(true);
  
  /**
   * Flag to check if data is being fetched
   * @type {React.MutableRefObject<boolean>}
   */
  const isFetchingRef = useRef(false);

  /**
   * Set up cleanup on component unmount
   */
  useEffect(() => {
    isMountedRef.current = true;
    
    return () => {
      isMountedRef.current = false;
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, []);

  /**
   * Fetches user data from the API with conditional request support
   * 
   * @async
   * @returns {Promise<void>}
   */
  const fetchUsers = async () => {
    // Prevent concurrent fetches
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;
    
    try {
      // Set up headers for conditional request
      const headers = {
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      };
      
      console.log('Fetching user data...');
      setLoading(users === null); // Only show loading on first load
      
      const [usersResponse, formatResponse] = await Promise.all([
        fetch(`/api/users?start=${page * pageSize}&length=${pageSize}&search=${debouncedSearch}`, {
          headers
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
      
      // Only update state if component is still mounted
      if (isMountedRef.current) {
        // Ensure consistent field IDs
        const fields = formatData.fields || [];
        if (fields.length > 0 && fields[0].id !== 'field') {
          fields[0].id = 'field';
        }
        
        setFormatFields(fields);
        setUsers(userData.response?.data || []);
        setTotalRecords(userData.response?.recordsTotal || 0);
        setError(null);
        
        // Update last updated timestamp
        lastUpdatedRef.current = Date.now();
        
        console.log(`Fetched ${userData.response?.data?.length || 0} users`);
      }
    } catch (error) {
      console.error('Error fetching user data:', error);
      if (isMountedRef.current) {
        setError(error.message || 'Failed to load users');
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
      isFetchingRef.current = false;
    }
  };
  
  /**
   * Debounce search input to reduce API calls
   */
  useEffect(() => {
    const timer = setTimeout(() => {
      if (search !== debouncedSearch) {
        console.log(`Search term changed from "${debouncedSearch}" to "${search}"`);
        setDebouncedSearch(search);
      }
    }, 500); // 500ms debounce
    
    return () => clearTimeout(timer);
  }, [search, debouncedSearch]);
  
  /**
   * Set up visibility-based refreshing
   * Only refresh when the tab is visible and on a reasonable schedule
   */
  useEffect(() => {
    console.log(`Setting up optimized refresh strategy for users (60 seconds)`);
    
    // Force refresh immediately on mount
    fetchUsers();
    
    // Set up a timer with exactly 60 seconds for users
    timerRef.current = setInterval(() => {
      // Only refresh if the page is visible to the user
      if (document.visibilityState === 'visible') {
        // Always refresh regardless of how recent the data is
        console.log('User data scheduled refresh - page is visible');
        fetchUsers();
      } else {
        console.log('Skipping user refresh - page not visible');
      }
    }, 60000); // Refresh exactly every 60 seconds when visible
    
    // Add visibility change listener to refresh when user returns to tab
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        console.log('Page became visible, refreshing user data immediately');
        fetchUsers();
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      console.log('Cleaning up user refresh timers');
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []); // Intentionally empty dependency array - we want this to run once

  /**
   * Force refresh when pagination or search changes
   */
  useEffect(() => {
    console.log(`Parameters changed: page=${page}, search=${debouncedSearch}`);
    fetchUsers();
  }, [page, pageSize, debouncedSearch]);

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

  /**
   * Force a manual refresh of the data
   */
  const handleManualRefresh = () => {
    console.log('Manual refresh requested');
    fetchUsers();
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
            <div className="flex items-center">
              <div className="text-xs text-gray-400 mr-2">
                Updates every 60 seconds
              </div>
              <button 
                onClick={handleManualRefresh}
                className="btn-secondary !py-1 !px-2"
                title="Refresh now"
              >
                <RefreshCw className="h-4 w-4" />
              </button>
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