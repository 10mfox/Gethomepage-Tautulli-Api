/**
 * Debug dashboard endpoint
 * Provides system diagnostics with HTML and JSON interfaces
 * @module api/debug/debugDashboard
 */
const express = require('express');
const { cache } = require('../../services/cacheService');
const { logError } = require('../../../logger');
const { 
  getSystemInfo, 
  getCacheTTLSettings 
} = require('./debugUtils');

const router = express.Router();

/**
 * Debug dashboard endpoint - provides system diagnostics with human-friendly interface
 * 
 * @route GET /api/debug
 */
router.get('/', async (req, res) => {
  try {
    // Get system info for dashboard
    const systemInfo = await getSystemInfo();
    
    // Get cache keys
    const keys = cache.keys();
    
    // Get cache TTL values
    const cacheTTLs = getCacheTTLSettings();
    
    // Determine if verbose logging is enabled
    const cacheService = require('../../services/cacheService');
    const verboseLogging = cacheService.isVerboseLoggingEnabled();
    
    // Check if the request prefers HTML (browser) or JSON (API)
    const acceptHeader = req.headers.accept || '';
    if (acceptHeader.includes('text/html')) {
      // Respond with HTML page
      res.setHeader('Content-Type', 'text/html');
      res.send(`
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Tautulli Manager Debug Interface</title>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
              line-height: 1.6;
              color: #e2e8f0;
              background-color: #0f172a;
              margin: 0;
              padding: 20px;
            }
            .container {
              max-width: 1200px;
              margin: 0 auto;
            }
            h1 {
              color: #f8fafc;
              margin-bottom: 30px;
              border-bottom: 1px solid #334155;
              padding-bottom: 10px;
            }
            .dashboard {
              display: grid;
              grid-template-columns: repeat(auto-fit, minmax(500px, 1fr));
              gap: 20px;
              margin-bottom: 30px;
            }
            .card {
              background-color: #1e293b;
              border-radius: 8px;
              padding: 20px;
              box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            }
            .card h2 {
              margin-top: 0;
              margin-bottom: 15px;
              color: #f8fafc;
              font-size: 1.25rem;
              border-bottom: 1px solid #334155;
              padding-bottom: 10px;
            }
            .info-table {
              width: 100%;
              border-collapse: collapse;
            }
            .info-table td {
              padding: 8px 0;
              border-bottom: 1px solid #334155;
            }
            .info-table tr:last-child td {
              border-bottom: none;
            }
            .info-table td:first-child {
              font-weight: 500;
              color: #94a3b8;
              width: 40%;
            }
            .status {
              display: inline-block;
              padding: 3px 8px;
              border-radius: 4px;
              font-size: 0.75rem;
              font-weight: 600;
            }
            .status-good {
              background-color: #065f46;
              color: #a7f3d0;
            }
            .status-bad {
              background-color: #7f1d1d;
              color: #fecaca;
            }
            .buttons {
              display: flex;
              flex-wrap: wrap;
              gap: 10px;
              margin-bottom: 20px;
            }
            .button {
              background-color: #2563eb;
              color: white;
              border: none;
              padding: 8px 16px;
              border-radius: 4px;
              cursor: pointer;
              font-weight: 500;
              transition: background-color 0.2s;
            }
            .button:hover {
              background-color: #1d4ed8;
            }
            .button-danger {
              background-color: #dc2626;
            }
            .button-danger:hover {
              background-color: #b91c1c;
            }
            .button-success {
              background-color: #059669;
            }
            .button-success:hover {
              background-color: #047857;
            }
            .cache-keys {
              background-color: #1e293b;
              border-radius: 8px;
              padding: 20px;
              margin-top: 20px;
            }
            .cache-keys h2 {
              margin-top: 0;
              font-size: 1.25rem;
              border-bottom: 1px solid #334155;
              padding-bottom: 10px;
            }
            .cache-key-list {
              display: flex;
              flex-wrap: wrap;
              gap: 8px;
              margin-bottom: 20px;
            }
            .cache-key {
              background-color: #334155;
              padding: 6px 12px;
              border-radius: 4px;
              font-size: 0.875rem;
              font-family: monospace;
            }
            .footer {
              margin-top: 40px;
              text-align: center;
              font-size: 0.875rem;
              color: #64748b;
            }
            .modal {
              display: none;
              position: fixed;
              z-index: 1000;
              left: 0;
              top: 0;
              width: 100%;
              height: 100%;
              background-color: rgba(0, 0, 0, 0.7);
              align-items: center;
              justify-content: center;
            }
            .modal-content {
              background-color: #1e293b;
              border-radius: 8px;
              padding: 20px;
              width: 90%;
              max-width: 500px;
              box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
            }
            .modal-title {
              margin-top: 0;
              color: #f8fafc;
              font-size: 1.25rem;
              border-bottom: 1px solid #334155;
              padding-bottom: 10px;
              margin-bottom: 15px;
            }
            .modal-actions {
              display: flex;
              justify-content: flex-end;
              gap: 10px;
              margin-top: 20px;
            }
            .col-span-2 {
              grid-column: span 2;
            }
            .alert {
              padding: 12px 16px;
              border-radius: 4px;
              margin-bottom: 15px;
              display: none;
            }
            .alert-success {
              background-color: #064e3b;
              color: #a7f3d0;
              border: 1px solid #065f46;
            }
            .alert-error {
              background-color: #7f1d1d;
              color: #fecaca;
              border: 1px solid #991b1b;
            }
            .version-info {
              background-color: #1e293b;
              border-radius: 4px;
              padding: 10px;
              margin-top: 10px;
              display: flex;
              justify-content: space-between;
              align-items: center;
            }
            /* Auto-refresh styles */
            .refresh-bar {
              background-color: #1e293b;
              border-radius: 8px;
              padding: 15px;
              margin-bottom: 20px;
              display: flex;
              flex-wrap: wrap;
              align-items: center;
              justify-content: space-between;
              gap: 10px;
            }
            .refresh-controls {
              display: flex;
              align-items: center;
              gap: 15px;
            }
            .toggle-switch {
              position: relative;
              display: inline-block;
              width: 50px;
              height: 24px;
            }
            .toggle-switch input {
              opacity: 0;
              width: 0;
              height: 0;
            }
            .toggle-slider {
              position: absolute;
              cursor: pointer;
              top: 0;
              left: 0;
              right: 0;
              bottom: 0;
              background-color: #4b5563;
              transition: .4s;
              border-radius: 24px;
            }
            .toggle-slider:before {
              position: absolute;
              content: "";
              height: 18px;
              width: 18px;
              left: 3px;
              bottom: 3px;
              background-color: white;
              transition: .4s;
              border-radius: 50%;
            }
            input:checked + .toggle-slider {
              background-color: #2563eb;
            }
            input:checked + .toggle-slider:before {
              transform: translateX(26px);
            }
            .refresh-countdown {
              display: flex;
              align-items: center;
              gap: 8px;
              font-size: 0.875rem;
              color: #94a3b8;
            }
            .countdown-timer {
              background-color: #334155;
              padding: 4px 10px;
              border-radius: 4px;
              font-family: monospace;
              letter-spacing: 0.5px;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>Tautulli Manager Debug Interface</h1>
            
            <!-- Auto-refresh controls -->
            <div class="refresh-bar">
              <div class="refresh-controls">
                <div class="form-group" style="flex-direction: row; align-items: center; gap: 10px;">
                  <label class="form-label" style="margin: 0;">Auto-refresh:</label>
                  <label class="toggle-switch">
                    <input type="checkbox" id="auto-refresh-toggle">
                    <span class="toggle-slider"></span>
                  </label>
                </div>
                
                <div class="form-group" style="flex-direction: row; align-items: center; gap: 10px;">
                  <label class="form-label" style="margin: 0;">Interval:</label>
                  <select id="refresh-interval" class="form-input" style="width: 120px;">
                    <option value="10">10 seconds</option>
                    <option value="30">30 seconds</option>
                    <option value="60" selected>1 minute</option>
                    <option value="300">5 minutes</option>
                    <option value="600">10 minutes</option>
                  </select>
                </div>
              </div>
              
              <div class="refresh-countdown">
                <span>Next refresh:</span>
                <span id="countdown-timer" class="countdown-timer">00:00</span>
                <button id="manual-refresh" class="button">Refresh Now</button>
              </div>
            </div>
            
            <div class="buttons">
              <button class="button" onclick="refreshAll()">Refresh All Cache</button>
              <button class="button" onclick="refreshUsers()">Refresh Users</button>
              <button class="button" onclick="refreshLibraries()">Refresh Libraries</button>
              <button class="button" onclick="refreshMedia()">Refresh Media</button>
              <button class="button ${verboseLogging ? 'button-success' : ''}" onclick="toggleVerboseLogging()">
                ${verboseLogging ? 'Disable Verbose Logging' : 'Enable Verbose Logging'}
              </button>
              <button class="button" onclick="clearCache()">Clear Cache</button>
              <button class="button button-danger" onclick="showResetConfirmation()">Reset Settings</button>
            </div>
            
            <div class="dashboard">
              ${Object.values(systemInfo).map(section => `
                <div class="card">
                  <h2>${section.title}</h2>
                  <table class="info-table">
                    <tbody>
                      ${section.items.map(item => `
                        <tr>
                          <td>${item.label}</td>
                          <td>
                            ${item.status ? 
                              `<span class="status status-${item.status}">${item.value}</span>` : 
                              item.value}
                          </td>
                        </tr>
                      `).join('')}
                    </tbody>
                  </table>
                </div>
              `).join('')}
            </div>
            
            <div class="cache-keys">
              <h2>Cache Keys (${keys.length})</h2>
              <div class="text-sm text-gray-400 mb-4">
                All data refreshes every 60 seconds for optimal performance
              </div>
              <div class="cache-key-list">
                ${keys.map(key => `<div class="cache-key">${key}</div>`).join('')}
              </div>
              <div class="version-info">
                <span>Node.js: ${process.version}</span>
                <span>Server Time: ${new Date().toLocaleString()}</span>
              </div>
            </div>
            
            <div class="footer">
              <p>Tautulli Manager Debug Interface • Server Time: ${new Date().toLocaleString()}</p>
            </div>
          </div>
          
          <!-- Reset Settings Confirmation Modal -->
          <div id="resetModal" class="modal">
            <div class="modal-content">
              <h3 class="modal-title">Reset Settings Confirmation</h3>
              <p>This will reset ALL settings to their default values. All customized formats, sections, and connection settings will be lost.</p>
              <p>This action cannot be undone.</p>
              <div class="modal-actions">
                <button class="button" onclick="closeModal()">Cancel</button>
                <button class="button button-danger" onclick="resetSettings()">Reset All Settings</button>
              </div>
            </div>
          </div>
          
          <script>
            // Auto-refresh functionality
            let autoRefreshEnabled = false;
            let refreshInterval = 60; // Default: 60 seconds
            let countdownInterval;
            let remainingSeconds = 0;
            
            // Load saved preferences from localStorage
            function loadAutoRefreshPreferences() {
              if (localStorage.getItem('debugAutoRefresh') !== null) {
                autoRefreshEnabled = localStorage.getItem('debugAutoRefresh') === 'true';
                document.getElementById('auto-refresh-toggle').checked = autoRefreshEnabled;
              }
              
              if (localStorage.getItem('debugRefreshInterval')) {
                refreshInterval = parseInt(localStorage.getItem('debugRefreshInterval'));
                document.getElementById('refresh-interval').value = refreshInterval;
              }
              
              updateAutoRefresh();
            }
            
            // Update auto-refresh state
            function updateAutoRefresh() {
              if (autoRefreshEnabled) {
                startCountdown();
              } else {
                stopCountdown();
              }
            }
            
            // Start the countdown timer
            function startCountdown() {
              stopCountdown(); // Clear any existing countdown
              
              remainingSeconds = refreshInterval;
              updateCountdownDisplay();
              
              countdownInterval = setInterval(() => {
                remainingSeconds--;
                updateCountdownDisplay();
                
                if (remainingSeconds <= 0) {
                  // Refresh the page when countdown reaches zero
                  window.location.reload();
                }
              }, 1000);
            }
            
            // Stop the countdown timer
            function stopCountdown() {
              clearInterval(countdownInterval);
              countdownInterval = null;
            }
            
            // Update the countdown display
            function updateCountdownDisplay() {
              const minutes = Math.floor(remainingSeconds / 60);
              const seconds = remainingSeconds % 60;
              document.getElementById('countdown-timer').textContent = 
                \`\${minutes.toString().padStart(2, '0')}:\${seconds.toString().padStart(2, '0')}\`;
            }
            
            // Event listeners for auto-refresh controls
            document.getElementById('auto-refresh-toggle').addEventListener('change', function() {
              autoRefreshEnabled = this.checked;
              localStorage.setItem('debugAutoRefresh', autoRefreshEnabled);
              updateAutoRefresh();
            });
            
            document.getElementById('refresh-interval').addEventListener('change', function() {
              refreshInterval = parseInt(this.value);
              localStorage.setItem('debugRefreshInterval', refreshInterval);
              
              if (autoRefreshEnabled) {
                startCountdown(); // Restart countdown with new interval
              }
            });
            
            document.getElementById('manual-refresh').addEventListener('click', function() {
              window.location.reload();
            });
            
            // Initialize auto-refresh on page load
            document.addEventListener('DOMContentLoaded', loadAutoRefreshPreferences);
            
            function refreshAll() {
              fetch('/api/debug/refresh', { method: 'POST' })
                .then(response => response.json())
                .then(data => {
                  if (data.success) {
                    alert('All cache data refreshed successfully in ' + data.durationMs + 'ms');
                    window.location.reload();
                  } else {
                    alert('Failed to refresh cache data: ' + data.error);
                  }
                })
                .catch(err => alert('Error: ' + err.message));
            }
            
            function refreshUsers() {
              refreshKey('users');
            }
            
            function refreshLibraries() {
              refreshKey('libraries');
            }
            
            function refreshMedia() {
              refreshKey('recent_media');
            }
            
            function refreshKey(key) {
              fetch('/api/debug/refresh/' + key, { method: 'POST' })
                .then(response => response.json())
                .then(data => {
                  if (data.success) {
                    alert(key + ' data refreshed successfully in ' + data.durationMs + 'ms');
                    window.location.reload();
                  } else {
                    alert('Failed to refresh ' + key + ' data: ' + data.error);
                  }
                })
                .catch(err => alert('Error: ' + err.message));
            }
            
            function toggleVerboseLogging() {
              fetch('/api/debug/toggle-verbose-logging', { method: 'POST' })
                .then(response => response.json())
                .then(data => {
                  alert('Verbose logging ' + (data.enabled ? 'enabled' : 'disabled'));
                  window.location.reload();
                })
                .catch(err => alert('Error: ' + err.message));
            }
            
            function clearCache() {
              if (confirm('Are you sure you want to clear the entire cache?')) {
                fetch('/api/debug/clear-cache', { method: 'POST' })
                  .then(response => response.json())
                  .then(data => {
                    if (data.success) {
                      alert('Cache cleared successfully');
                      window.location.reload();
                    } else {
                      alert('Failed to clear cache: ' + data.error);
                    }
                  })
                  .catch(err => alert('Error: ' + err.message));
              }
            }
            
            function showResetConfirmation() {
              document.getElementById('resetModal').style.display = 'flex';
            }
            
            function closeModal() {
              document.getElementById('resetModal').style.display = 'none';
            }
            
            function resetSettings() {
              if (confirm('Are you absolutely sure you want to reset ALL settings to defaults?')) {
                fetch('/api/debug/reset-settings', { method: 'POST' })
                  .then(response => response.json())
                  .then(data => {
                    if (data.success) {
                      alert('Settings have been reset to defaults successfully');
                      window.location.reload();
                    } else {
                      alert('Failed to reset settings: ' + data.error);
                    }
                  })
                  .catch(err => alert('Error: ' + err.message));
              }
              closeModal();
            }
            
            // Close modal if clicked outside
            window.onclick = function(event) {
              const modal = document.getElementById('resetModal');
              if (event.target === modal) {
                closeModal();
              }
            }
          </script>
        </body>
      </html>
      `);
    } else {
      // Respond with JSON for API calls
      res.json({
        system: {
          environment: process.env.NODE_ENV || "development",
          port: process.env.TAUTULLI_CUSTOM_PORT || 3010,
          refreshInterval: `60 seconds (fixed for optimal performance)`,
          serverTime: new Date().toISOString(),
          uptime: systemInfo.general.items.find(i => i.label === "Server Uptime").value,
          localIp: systemInfo.general.items.find(i => i.label === "Local IP Address").value,
          platform: process.platform,
          arch: process.arch,
          release: process.release,
          cpuCores: os.cpus().length,
          memory: {
            totalGB: Math.round(os.totalmem() / (1024 * 1024 * 1024) * 100) / 100,
            freeGB: Math.round(os.freemem() / (1024 * 1024 * 1024) * 100) / 100,
            processRssMB: Math.round(process.memoryUsage().rss / (1024 * 1024) * 100) / 100,
            processHeapMB: Math.round(process.memoryUsage().heapUsed / (1024 * 1024) * 100) / 100
          }
        },
        tautulli: {
          connected: !!systemInfo.tautulli.items.find(i => i.label === "Base URL").value,
          baseUrl: systemInfo.tautulli.items.find(i => i.label === "Base URL").value,
          apiKeyConfigured: !!systemInfo.tautulli.items.find(i => i.label === "API Key").value
        },
        cache: {
          keys: keys.length,
          keyList: keys,
          hits: stats.hits,
          misses: stats.misses,
          hitRate: hitRate.hitRate,
          lastUpdated: lastUpdated ? new Date(lastUpdated).toISOString() : null,
          verboseLogging: verboseLogging,
          refreshInterval: "60 seconds (fixed)"
        },
        config: {
          configuredLibraries: systemInfo.config.items.find(i => i.label === "Configured Libraries").value,
          settingsFile: systemInfo.config.items.find(i => i.label === "Settings File").value
        }
      });
    }
  } catch (error) {
    logError('Debug Endpoint', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = { dashboardRoutes: router };