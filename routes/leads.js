/**
 * Leads Routes - Main Entry Point
 * 
 * This file has been restructured into modular components:
 * - queryRoutes.js - Search and filter operations
 * - crudRoutes.js - Create, Read, Update, Delete operations
 * - bulkRoutes.js - Bulk operations
 * - uploadRoutes.js - File upload operations
 * - ../utils/leadHelpers.js - Helper functions
 * 
 * @author Fenix CRM Team
 * @version 2.0.0
 */

const express = require('express');
const router = express.Router();

// Import modular route handlers
const leadsRouter = require('./leads/index');

// Mount all leads routes
router.use('/', leadsRouter);

module.exports = router;
