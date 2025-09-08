const express = require('express');
const router = express.Router();
const LeadsHistory = require('../models/LeadsHistory');
const mongoose = require('mongoose');
const { authenticateToken } = require('../middleware/auth');

// Get history for a specific lead
router.get('/lead/:leadId', authenticateToken, async (req, res) => {
  try {
    const { leadId } = req.params;
    const { page = 1, limit = 50, actionType } = req.query;

    // Validate leadId
    if (!mongoose.Types.ObjectId.isValid(leadId)) {
      return res.status(400).json({
        success: false,
        message: 'Невірний ID ліда'
      });
    }

    const skip = (page - 1) * limit;
    const query = { leadId };

    // Filter by action type if provided
    if (actionType) {
      query.actionType = actionType;
    }

    // Get history with pagination
    const [history, totalCount] = await Promise.all([
      LeadsHistory.find(query)
        .populate('adminId', 'login email')
        .sort({ timestamp: -1 })
        .limit(parseInt(limit))
        .skip(skip)
        .lean(),
      LeadsHistory.countDocuments(query)
    ]);

    // Calculate pagination info
    const totalPages = Math.ceil(totalCount / limit);
    const hasNextPage = page < totalPages;
    const hasPrevPage = page > 1;

    res.json({
      success: true,
      data: {
        history,
        pagination: {
          currentPage: parseInt(page),
          totalPages,
          totalCount,
          limit: parseInt(limit),
          hasNextPage,
          hasPrevPage
        }
      }
    });

  } catch (error) {
    console.error('Error fetching lead history:', error);
    res.status(500).json({
      success: false,
      message: 'Помилка при отриманні історії ліда',
      error: error.message
    });
  }
});

// Get all history (with filters)
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 100, 
      actionType, 
      adminId, 
      startDate, 
      endDate 
    } = req.query;

    const skip = (page - 1) * limit;
    const query = {};

    // Apply filters
    if (actionType) {
      query.actionType = actionType;
    }

    if (adminId && mongoose.Types.ObjectId.isValid(adminId)) {
      query.adminId = adminId;
    }

    if (startDate || endDate) {
      query.timestamp = {};
      if (startDate) {
        query.timestamp.$gte = new Date(startDate);
      }
      if (endDate) {
        query.timestamp.$lte = new Date(endDate);
      }
    }

    // Get history with pagination
    const [history, totalCount] = await Promise.all([
      LeadsHistory.find(query)
        .populate('leadId', 'name phone email')
        .populate('adminId', 'login email')
        .sort({ timestamp: -1 })
        .limit(parseInt(limit))
        .skip(skip)
        .lean(),
      LeadsHistory.countDocuments(query)
    ]);

    // Calculate pagination info
    const totalPages = Math.ceil(totalCount / limit);
    const hasNextPage = page < totalPages;
    const hasPrevPage = page > 1;

    res.json({
      success: true,
      data: {
        history,
        pagination: {
          currentPage: parseInt(page),
          totalPages,
          totalCount,
          limit: parseInt(limit),
          hasNextPage,
          hasPrevPage
        }
      }
    });

  } catch (error) {
    console.error('Error fetching history:', error);
    res.status(500).json({
      success: false,
      message: 'Помилка при отриманні історії',
      error: error.message
    });
  }
});

// Get admin activity
router.get('/admin/:adminId', authenticateToken, async (req, res) => {
  try {
    const { adminId } = req.params;
    const { page = 1, limit = 100, actionType } = req.query;

    // Validate adminId
    if (!mongoose.Types.ObjectId.isValid(adminId)) {
      return res.status(400).json({
        success: false,
        message: 'Невірний ID адміністратора'
      });
    }

    const skip = (page - 1) * limit;
    const query = { adminId };

    // Filter by action type if provided
    if (actionType) {
      query.actionType = actionType;
    }

    // Get admin activity with pagination
    const [history, totalCount] = await Promise.all([
      LeadsHistory.find(query)
        .populate('leadId', 'name phone email')
        .sort({ timestamp: -1 })
        .limit(parseInt(limit))
        .skip(skip)
        .lean(),
      LeadsHistory.countDocuments(query)
    ]);

    // Calculate pagination info
    const totalPages = Math.ceil(totalCount / limit);
    const hasNextPage = page < totalPages;
    const hasPrevPage = page > 1;

    res.json({
      success: true,
      data: {
        history,
        pagination: {
          currentPage: parseInt(page),
          totalPages,
          totalCount,
          limit: parseInt(limit),
          hasNextPage,
          hasPrevPage
        }
      }
    });

  } catch (error) {
    console.error('Error fetching admin activity:', error);
    res.status(500).json({
      success: false,
      message: 'Помилка при отриманні активності адміністратора',
      error: error.message
    });
  }
});

// Create new history entry
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { leadId, actionType, description, adminId, metadata } = req.body;

    // Validate required fields
    if (!leadId || !actionType || !description || !adminId) {
      return res.status(400).json({
        success: false,
        message: 'Відсутні обов\'язкові поля: leadId, actionType, description, adminId'
      });
    }

    // Validate ObjectIds
    if (!mongoose.Types.ObjectId.isValid(leadId) || !mongoose.Types.ObjectId.isValid(adminId)) {
      return res.status(400).json({
        success: false,
        message: 'Невірний формат ID'
      });
    }

    // Create history entry
    const historyEntry = await LeadsHistory.createHistoryEntry({
      leadId,
      actionType,
      description,
      adminId,
      metadata: metadata || {}
    });

    // Populate the created entry
    const populatedEntry = await LeadsHistory.findById(historyEntry._id)
      .populate('leadId', 'name phone email')
      .populate('adminId', 'name email')
      .lean();

    res.status(201).json({
      success: true,
      data: populatedEntry,
      message: 'Запис історії успішно створено'
    });

  } catch (error) {
    console.error('Error creating history entry:', error);
    res.status(500).json({
      success: false,
      message: 'Помилка при створенні запису історії',
      error: error.message
    });
  }
});

// Get action types statistics
router.get('/stats/action-types', authenticateToken, async (req, res) => {
  try {
    const { startDate, endDate, leadId, adminId } = req.query;
    
    const matchQuery = {};
    
    // Apply date filters
    if (startDate || endDate) {
      matchQuery.timestamp = {};
      if (startDate) {
        matchQuery.timestamp.$gte = new Date(startDate);
      }
      if (endDate) {
        matchQuery.timestamp.$lte = new Date(endDate);
      }
    }
    
    // Apply lead filter
    if (leadId && mongoose.Types.ObjectId.isValid(leadId)) {
      matchQuery.leadId = new mongoose.Types.ObjectId(leadId);
    }
    
    // Apply admin filter
    if (adminId && mongoose.Types.ObjectId.isValid(adminId)) {
      matchQuery.adminId = new mongoose.Types.ObjectId(adminId);
    }

    const stats = await LeadsHistory.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: '$actionType',
          count: { $sum: 1 },
          lastAction: { $max: '$timestamp' }
        }
      },
      { $sort: { count: -1 } }
    ]);

    res.json({
      success: true,
      data: stats
    });

  } catch (error) {
    console.error('Error fetching action types stats:', error);
    res.status(500).json({
      success: false,
      message: 'Помилка при отриманні статистики типів дій',
      error: error.message
    });
  }
});


module.exports = router;
