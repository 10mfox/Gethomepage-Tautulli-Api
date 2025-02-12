import React, { useState, useEffect } from 'react';
import { Download, RefreshCw } from 'lucide-react';

const DownloadView = () => {
  const [downloads, setDownloads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);

  const fetchDownloads = async (force = false) => {
    try {
      setIsRefreshing(true);
      
      if (force) {
        await fetch('/api/cache/clear', { method: 'POST' });
      }

      const response = await fetch('/api/downloads');
      const data = await response.json();
      
      setDownloads(data.response?.data || []);
      setLastUpdated(new Date());
      setError(null);
    } catch (error) {
      console.error('Error fetching downloads:', error);
      setError('Failed to load download data');
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchDownloads();
    // Set up polling every 5 seconds
    const interval = setInterval(() => fetchDownloads(), 5000);
    return () => clearInterval(interval);
  }, []);

  const formatSpeed = (bytesPerSecond) => {
    if (!bytesPerSecond || bytesPerSecond === 0) return 'N/A';
    const mbps = (bytesPerSecond / (1024 * 1024)).toFixed(2);
    return `${mbps} MB/s`;
  };

  const formatETA = (seconds) => {
    if (!seconds || seconds === 0) return 'N/A';
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${String(remainingSeconds).padStart(2, '0')}`;
  };

  const formatProgress = (progress) => {
    // Ensure progress is a number and valid
    const numProgress = Number(progress);
    if (isNaN(numProgress)) return '0.0';
    return numProgress.toFixed(1);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div className="space-y-1">
          <h2 className="text-xl font-semibold text-white flex items-center gap-2">
            <Download className="h-5 w-5" />
            Active Downloads
          </h2>
          {lastUpdated && (
            <p className="text-sm text-gray-400">
              Last updated: {lastUpdated.toLocaleTimeString()}
            </p>
          )}
        </div>

        <button
          onClick={() => fetchDownloads(true)}
          disabled={isRefreshing}
          className={`flex items-center gap-2 px-3 py-2 rounded text-white transition-colors ${
            isRefreshing ? 'bg-gray-600 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'
          }`}
        >
          <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {loading && !isRefreshing ? (
        <div className="text-center py-8 text-gray-400">Loading downloads...</div>
      ) : error ? (
        <div className="text-center py-8 text-red-400">{error}</div>
      ) : downloads.length === 0 ? (
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-8 text-center text-gray-400">
          No active downloads
        </div>
      ) : (
        <div className="bg-gray-800 border border-gray-700 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-700">
                  <th className="p-4 text-left text-gray-300">User</th>
                  <th className="p-4 text-left text-gray-300">Title</th>
                  <th className="p-4 text-left text-gray-300">Progress</th>
                  <th className="p-4 text-left text-gray-300">Speed</th>
                  <th className="p-4 text-left text-gray-300">ETA</th>
                  <th className="p-4 text-left text-gray-300">Quality</th>
                </tr>
              </thead>
              <tbody>
                {downloads.map((download) => (
                  <tr key={download.session_id} className="border-b border-gray-700 hover:bg-gray-700">
                    <td className="p-4 text-gray-300">{download.user}</td>
                    <td className="p-4">
                      <div className="text-gray-300">{download.title}</div>
                      <div className="text-sm text-gray-500">
                        {download.media_type} • {download.stream_container || 'Unknown'}
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="w-32 bg-gray-700 rounded-full h-2">
                        <div
                          className="bg-blue-600 h-2 rounded-full"
                          style={{ width: `${download.progress || 0}%` }}
                        />
                      </div>
                      <div className="text-sm text-gray-400 mt-1">
                        {formatProgress(download.progress)}%
                      </div>
                    </td>
                    <td className="p-4 text-gray-300">{formatSpeed(download.speed)}</td>
                    <td className="p-4 text-gray-300">{formatETA(download.eta)}</td>
                    <td className="p-4">
                      <div className="text-gray-300">{download.quality || 'Unknown'}</div>
                      <div className="text-sm text-gray-500">{download.transcode_decision || 'Direct'}</div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default DownloadView;