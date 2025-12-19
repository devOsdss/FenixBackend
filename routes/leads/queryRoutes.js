const express = require('express');
const Lead = require('../../models/Lead');
const router = express.Router();
const { authenticateToken } = require('../../middleware/auth');
const { buildLeadsFilter, buildSortObject } = require('../../utils/leadHelpers');
const { createLogger } = require('../../utils/logger');

const logger = createLogger('LeadsQuery');

/**
 * @route GET /api/leads/statuses
 * @desc Get all unique statuses from leads
 * @access Private
 */
router.get('/statuses', authenticateToken, async (req, res) => {
  try {
    const statuses = await Lead.distinct('status', { 
      hidden: { $ne: true }
    });
    
    // Filter out empty strings and sort alphabetically
    const filteredStatuses = statuses
      .filter(status => status && status.trim() !== '')
      .sort();
    
    res.json({
      success: true,
      data: filteredStatuses
    });
  } catch (error) {
    logger.error('Failed to fetch statuses', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Помилка при отриманні статусів',
      error: error.message
    });
  }
});

/**
 * @route GET /api/leads/utm-sources
 * @desc Get all unique UTM sources from leads
 * @access Private
 */
router.get('/utm-sources', authenticateToken, async (req, res) => {
  try {
    const utmSources = await Lead.distinct('utm_source', { 
      utm_source: { $exists: true, $ne: null, $ne: '' },
      hidden: { $ne: true }
    });
    
    // Filter out empty strings and sort alphabetically
    const filteredSources = utmSources
      .filter(source => source && source.trim() !== '')
      .sort();
    
    res.json({
      success: true,
      data: filteredSources
    });
  } catch (error) {
    logger.error('Failed to fetch UTM sources', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Помилка при отриманні UTM джерел',
      error: error.message
    });
  }
});

/**
 * @route GET /api/leads/departments
 * @desc Get all unique departments from leads
 * @access Private
 */
router.get('/departments', authenticateToken, async (req, res) => {
  try {
    const departments = await Lead.distinct('department', { 
      department: { $exists: true, $ne: null, $ne: '' },
      hidden: { $ne: true }
    });
    
    // Filter out empty strings and sort
    const filteredDepartments = departments
      .filter(dept => dept && dept.toString().trim() !== '')
      .sort();
    
    res.json({
      success: true,
      data: filteredDepartments
    });
  } catch (error) {
    logger.error('Failed to fetch departments', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Помилка при отриманні відділів',
      error: error.message
    });
  }
});

/**
 * @route GET /api/leads
 * @desc Get all leads with pagination and filtering
 * @access Private
 */
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    
    // Validate pagination parameters
    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(10000, Math.max(1, parseInt(limit) || 20)); // Limit max to 10000 for stats
    
    // Add user info to query for role-based filtering
    const queryWithUser = {
      ...req.query,
      userRole: req.admin?.role,
      userId: req.admin?._id?.toString(),
      userTeam: req.admin?.team
    };
    
    // Build filter and sort objects
    const filter = await buildLeadsFilter(queryWithUser);
    const sort = buildSortObject(queryWithUser);
    
    const skip = (pageNum - 1) * limitNum;
    
    logger.info('Query parameters', { 
      page: pageNum, 
      limit: limitNum, 
      skip, 
      filterKeys: Object.keys(filter),
      dateFrom: req.query.dateFrom,
      dateTo: req.query.dateTo,
      hasTeamLeadAssignedAt: req.query.hasTeamLeadAssignedAt,
      teamLeadAssignedAtStart: req.query.teamLeadAssignedAtStart,
      teamLeadAssignedAtEnd: req.query.teamLeadAssignedAtEnd,
      filter: JSON.stringify(filter)
    });
    
    // Get total count for pagination
    const total = await Lead.countDocuments(filter);
    
    // Log total count for debugging
    if (req.query.hasTeamLeadAssignedAt) {
      logger.info('TeamLeadAssignedAt filter results', {
        total,
        limit: limitNum,
        hasFilter: !!filter.teamLeadAssignedAt
      });
    }
    
    // Get leads with pagination
    const leads = await Lead.find(filter)
      .sort(sort)
      .skip(skip)
      .limit(limitNum)
      .lean();
    
    // Log sample lead dates for debugging
    if (leads.length > 0) {
      logger.info('Sample lead dates', { 
        sampleLeads: leads.slice(0, 3).map(l => ({ 
          id: l._id, 
          dateCreate: l.dateCreate,
          phone: l.phone 
        }))
      });
    }
    
    // Also check if there are leads without date filter
    if (req.query.dateFrom || req.query.dateTo) {
      const filterWithoutDate = { ...filter };
      delete filterWithoutDate.dateCreate;
      const totalWithoutDate = await Lead.countDocuments(filterWithoutDate);
      logger.info('Leads without date filter', { totalWithoutDate, totalWithDate: total });
      
      // Get sample leads to see their dates
      const sampleLeads = await Lead.find(filterWithoutDate)
        .sort({ dateCreate: -1 })
        .limit(5)
        .select('_id phone dateCreate')
        .lean();
      logger.info('Sample leads from DB', { 
        samples: sampleLeads.map(l => ({ 
          id: l._id, 
          phone: l.phone,
          dateCreate: l.dateCreate 
        }))
      });
    }

    // Calculate pagination info
    const totalPages = Math.ceil(total / limitNum);
    const hasNextPage = pageNum < totalPages;
    const hasPrevPage = pageNum > 1;

    logger.info('Query results', { found: leads.length, total, pages: totalPages });

    res.json({
      success: true,
      data: leads,
      pagination: {
        current: pageNum,
        pages: totalPages,
        total: total,
        limit: limitNum,
        hasNextPage,
        hasPrevPage
      }
    });
  } catch (error) {
    logger.error('Failed to fetch leads', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Помилка при отриманні лідів',
      error: error.message
    });
  }
});

/**
 * @route GET /api/leads/search
 * @desc Search leads by phone, name, or email
 * @access Private
 */
router.get('/search', authenticateToken, async (req, res) => {
  try {
    const { q, limit = 10 } = req.query;
    
    if (!q || q.trim() === '') {
      return res.json({
        success: true,
        data: []
      });
    }

    const filter = await buildLeadsFilter({ search: q, hidden: 'false' });
    
    const leads = await Lead.find(filter)
      .select('name phone email status sourceDescription dateCreate')
      .sort({ dateCreate: -1 })
      .limit(parseInt(limit))
      .lean();

    res.json({
      success: true,
      data: leads
    });
  } catch (error) {
    logger.error('Failed to search leads', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Помилка при пошуку лідів',
      error: error.message
    });
  }
});

module.exports = router;
