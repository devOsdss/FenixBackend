const express = require('express');
const Lead = require('../../models/Lead');
const router = express.Router();
const { authenticateToken } = require('../../middleware/auth');
const { buildLeadsFilter, buildSortObject } = require('../../utils/leadHelpers');

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
    console.error('Error fetching statuses:', error);
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
    console.error('Error fetching UTM sources:', error);
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
    console.error('Error fetching departments:', error);
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
    const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 20)); // Limit max to 100
    
    // Build filter and sort objects
    const filter = await buildLeadsFilter(req.query);
    const sort = buildSortObject(req.query);
    
    const skip = (pageNum - 1) * limitNum;
    
    console.log('📋 Final filter object:', JSON.stringify(filter, null, 2));
    console.log('📄 Pagination:', { page: pageNum, limit: limitNum, skip });
    
    // Get total count for pagination
    const total = await Lead.countDocuments(filter);
    console.log('📊 Total leads matching filter:', total);
    
    // Get leads with pagination
    const leads = await Lead.find(filter)
      .sort(sort)
      .skip(skip)
      .limit(limitNum)
      .lean();

    // Calculate pagination info
    const totalPages = Math.ceil(total / limitNum);
    const hasNextPage = pageNum < totalPages;
    const hasPrevPage = pageNum > 1;

    console.log('📋 Found leads:', leads.length);
    console.log('📄 Pagination info:', { current: pageNum, pages: totalPages, total, limit: limitNum });

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
    console.error('Error fetching leads:', error);
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
    console.error('Error searching leads:', error);
    res.status(500).json({
      success: false,
      message: 'Помилка при пошуку лідів',
      error: error.message
    });
  }
});

module.exports = router;
