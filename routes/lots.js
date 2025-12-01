/**
 * LOT Routes
 * 
 * RESTful API endpoints for LOT management.
 * Implements proper HTTP methods, status codes, and middleware.
 * 
 * @module routes/lots
 * @requires express
 * @requires controllers/lotController
 * @requires middleware/auth
 * @author Senior Developer (5+ years experience)
 */

const express = require('express');
const router = express.Router();
const LotController = require('../controllers/lotController');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

// ==================== MIDDLEWARE ====================

/**
 * Apply authentication to all routes
 */
router.use(authenticateToken);

// ==================== ROUTES ====================

/**
 * @route   POST /api/lots
 * @desc    Create a new LOT
 * @access  Reten, Admin
 * @body    { leadId, lotName, amount, lotDate }
 * @returns { success, message, data }
 */
router.post(
  '/',
  authorizeRoles(['Reten', 'Admin']),
  LotController.createLot
);

/**
 * @route   GET /api/lots
 * @desc    Get all LOTs with filtering and pagination
 * @access  Authenticated users (role-based filtering applied)
 * @query   {
 *   page: number,
 *   limit: number,
 *   sortBy: string,
 *   sortOrder: 'asc' | 'desc',
 *   status: 'ACTIVE' | 'ARCHIVED' | 'CANCELLED',
 *   search: string,
 *   startDate: date,
 *   endDate: date,
 *   managerId: ObjectId,
 *   team: string
 * }
 * @returns { success, data, pagination }
 */
router.get(
  '/',
  LotController.getLots
);

/**
 * @route   GET /api/lots/stats
 * @desc    Get LOT statistics
 * @access  TeamLead, Admin
 * @query   { startDate, endDate, team }
 * @returns { success, data }
 */
router.get(
  '/stats',
  authorizeRoles(['TeamLead', 'Admin']),
  LotController.getLotStats
);

/**
 * @route   GET /api/lots/:id
 * @desc    Get single LOT by ID
 * @access  Authenticated users (access control applied)
 * @param   id - LOT ID
 * @returns { success, data }
 */
router.get(
  '/:id',
  LotController.getLotById
);

/**
 * @route   PATCH /api/lots/:id/amount
 * @desc    Update LOT amount
 * @access  Reten, Admin (own LOTs only for Reten)
 * @param   id - LOT ID
 * @body    { amount, reason }
 * @returns { success, message, data }
 */
router.patch(
  '/:id/amount',
  authorizeRoles(['Reten', 'Admin']),
  LotController.updateLotAmount
);

/**
 * @route   DELETE /api/lots/:id
 * @desc    Delete LOT (soft delete)
 * @access  Admin only
 * @param   id - LOT ID
 * @returns { success, message }
 */
router.delete(
  '/:id',
  authorizeRoles(['Admin']),
  LotController.deleteLot
);

// ==================== ERROR HANDLING ====================

/**
 * Handle 404 for undefined routes
 */
router.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Маршрут не найден'
  });
});

/**
 * Global error handler for this router
 */
router.use((err, req, res, next) => {
  console.error('LOT Route Error:', err);
  
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Внутренняя ошибка сервера',
    error: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
});

module.exports = router;
