const NodeCache = require('node-cache');
const cache = new NodeCache({ 
  stdTTL: 30, // 30 second cache
  checkperiod: 60 // Clean up every minute
});

module.exports = cache;