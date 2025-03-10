/**
 * Debug API router
 * Combines all debug-related routes
 * @module api/debug/debugRouter
 */
const express = require('express');
const { dashboardRoutes } = require('./debugDashboard');
const { cacheRoutes } = require('./debugCache');
const { settingsRoutes } = require('./debugSettings');
const { loggingRoutes } = require('./debugLogging');

const router = express.Router();

// Register all debug routes
router.use('/', dashboardRoutes);
router.use('/', cacheRoutes);
router.use('/', settingsRoutes);
router.use('/', loggingRoutes);

module.exports = { debugRouter: router };