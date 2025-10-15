const express = require('express');
const router = express.Router();

// Import route modules
const queryRoutes = require('./queryRoutes');
const crudRoutes = require('./crudRoutes');
const bulkRoutes = require('./bulkRoutes');
const uploadRoutes = require('./uploadRoutes');
const statsRoutes = require('./statsRoutes');

// Mount route modules
router.use('/', queryRoutes);
router.use('/', crudRoutes);
router.use('/bulk', bulkRoutes);
router.use('/upload', uploadRoutes);
router.use('/stats', statsRoutes);

module.exports = router;
