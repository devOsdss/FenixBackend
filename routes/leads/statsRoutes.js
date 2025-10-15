const express = require('express');
const Lead = require('../../models/Lead');
const router = express.Router();
const { authenticateToken } = require('../../middleware/auth');
const { buildLeadsFilter } = require('../../utils/leadHelpers');

/**
 * @route GET /api/leads/stats/overview
 * @desc Get leads statistics overview
 * @access Private
 */
router.get('/overview', authenticateToken, async (req, res) => {
  try {
    const stats = await Lead.aggregate([
      {
        $match: { hidden: { $ne: true } }
      },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);
    
    const total = await Lead.countDocuments({ hidden: { $ne: true } });
    
    res.json({
      success: true,
      data: {
        total,
        byStatus: stats.reduce((acc, item) => {
          acc[item._id] = item.count;
          return acc;
        }, {})
      }
    });

  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка при получении статистики'
    });
  }
});

/**
 * @route GET /api/leads/stats/status-counts
 * @desc Get leads count by status for filter buttons
 * @access Private
 */
router.get('/status-counts', authenticateToken, async (req, res) => {
  try {
    console.log("Status-counts: All query parameters:", req.query);
    const { 
      assigned, 
      search,
      hidden,
      department,
      sourceDescription,
      utm_source,
      dateFrom,
      dateTo,
      userRole,
      userId,
      userTeam
    } = req.query;

    // Build filter object using the helper function
    const filter = await buildLeadsFilter(req.query);

    // Handle statuses parameter - can be array or comma-separated string
    let visibleStatuses = null;
    
    if (req.query.statuses) {
      if (Array.isArray(req.query.statuses)) {
        visibleStatuses = req.query.statuses.filter(s => s && s.trim() !== '');
      } else if (typeof req.query.statuses === 'string' && req.query.statuses.trim().length > 0) {
        visibleStatuses = req.query.statuses.split(',').map(s => s.trim()).filter(Boolean);
      }
    }

    let counts = {};

    if (visibleStatuses && visibleStatuses.length > 0) {
      // Total with all applied filters
      const total = await Lead.countDocuments(filter);

      // Counts only for visible statuses
      const visibleCounts = await Lead.aggregate([
        { $match: { ...filter, status: { $in: visibleStatuses } } },
        { $group: { _id: '$status', count: { $sum: 1 } } }
      ]);

      // Build counts object: '' is total; include each requested status with 0 fallback
      counts[''] = total;
      visibleStatuses.forEach(s => { counts[s] = 0; });
      let knownSum = 0;
      visibleCounts.forEach(item => {
        const key = (item._id === null || item._id === undefined || item._id === '') ? 'NO_STATUS' : item._id;
        // If an empty status somehow appears among visible (unlikely), include under NO_STATUS
        if (key === 'NO_STATUS') {
          counts[key] = (counts[key] || 0) + item.count;
        } else {
          counts[key] = item.count;
        }
        knownSum += item.count;
      });

      // OTHER = total - sum(visible)
      const other = Math.max(0, total - knownSum);
      counts['OTHER'] = other;
    } else {
      // Get counts by status with applied filters (default behavior)
      const statusCounts = await Lead.aggregate([
        { $match: filter },
        { $group: { _id: '$status', count: { $sum: 1 } } }
      ]);

      // Get total count with applied filters
      const total = await Lead.countDocuments(filter);

      // Format response for filter buttons
      counts = { '': total };
      statusCounts.forEach(item => {
        const key = (item._id === null || item._id === undefined || item._id === '') ? 'NO_STATUS' : item._id;
        counts[key] = (counts[key] || 0) + item.count;
      });
    }
    
    res.json({
      success: true,
      data: counts
    });

  } catch (error) {
    console.error('Get status counts error:', error);
    console.error('Query parameters:', req.query);
    res.status(500).json({
      success: false,
      message: 'Помилка при отриманні кількості лідів',
      error: error.message
    });
  }
});

module.exports = router;
