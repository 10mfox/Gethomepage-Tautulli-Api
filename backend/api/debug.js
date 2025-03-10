/**
 * Debug API endpoint handler
 * Entry point for debug routes
 * @module api/debug
 */
const { debugRouter } = require('./debug/debugRouter');

// Re-export the debugRouter to maintain backward compatibility
module.exports = { debugRouter };