const express = require('express');
const router = express.Router();
const SuccessfulLead = require('../models/SuccessfulLeads');
const Lead = require('../models/Lead');
const mongoose = require('mongoose');
const { authenticateToken } = require('../middleware/auth');

// POST /api/successful-leads - Create successful lead
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { leadId, amount, closeDate, transferDate, payoutAmount, isPaid } = req.body;

    // Validation
    if (!leadId || !amount || !closeDate || !transferDate) {
      return res.status(400).json({
        success: false,
        message: 'Все поля обязательны: leadId, amount, closeDate, transferDate'
      });
    }

    // Validate payout: if isPaid=true, then payoutAmount is required
    const isPaidBoolean = isPaid === true || isPaid === 'true';
    if (isPaidBoolean && !payoutAmount) {
      return res.status(400).json({
        success: false,
        message: 'Укажите сумму выплаты'
      });
    }

    // Validate payoutAmount if provided
    if (payoutAmount) {
      const parsedPayoutAmount = parseFloat(payoutAmount);
      if (isNaN(parsedPayoutAmount) || parsedPayoutAmount < 0) {
        return res.status(400).json({
          success: false,
          message: 'Сумма выплаты должна быть положительным числом'
        });
      }
    }

    // Validate leadId
    if (!mongoose.Types.ObjectId.isValid(leadId)) {
      return res.status(400).json({
        success: false,
        message: 'Некорректный ID лида'
      });
    }

    // Get lead data
    const lead = await Lead.findById(leadId);
    if (!lead) {
      return res.status(404).json({
        success: false,
        message: 'Лид не найден'
      });
    }

    // Get admin data from lead or use current admin
    const assigned = lead.assigned || req.admin._id;
    const team = req.admin?.team || null;

    // Create successful lead
    const successfulLead = new SuccessfulLead({
      leadId,
      leadName: lead.name,
      amount: parseFloat(amount),
      closeDate: new Date(closeDate),
      transferDate: new Date(transferDate),
      assigned,
      team,
      payoutAmount: payoutAmount ? parseFloat(payoutAmount) : null,
      isPaid: isPaidBoolean
    });

    await successfulLead.save();

    // Update lead status to CONVERTED
    lead.status = 'CONVERTED';
    await lead.save();

    res.status(201).json({
      success: true,
      message: 'Успешный лид создан',
      data: successfulLead
    });

  } catch (error) {
    console.error('Error creating successful lead:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка при создании успешного лида',
      error: error.message
    });
  }
});

// GET /api/successful-leads - Get all successful leads
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { 
      assigned, 
      team,
      sortBy = 'closeDate', 
      sortOrder = 'desc',
      page = 1,
      limit = 50,
      startDate,
      endDate,
      userRole,
      userId
    } = req.query;
    
    console.log('📥 GET /api/successful-leads - Query params:', req.query);
    
    // Build filter
    const filter = {};
    
    // Team Fantom restriction: members can only see their own leads
    if (req.admin?.team === 'Team Fantom') {
      filter.assigned = req.admin._id;
      console.log('🔒 Team Fantom restriction applied:', { adminId: req.admin._id });
    } else {
      // All other users can see all successful leads
      // Optional filters by assigned or team
      if (assigned) {
        if (!mongoose.Types.ObjectId.isValid(assigned)) {
          return res.status(400).json({
            success: false,
            message: 'Некорректный ID ответственного'
          });
        }
        filter.assigned = assigned;
      }
      
      if (team) {
        filter.team = team;
      }
    }

    // Date range filter
    if (startDate || endDate) {
      filter.closeDate = {};
      if (startDate) {
        const start = new Date(startDate);
        filter.closeDate.$gte = start;
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setTime(end.getTime() + (24 * 60 * 60 * 1000) - 1);
        filter.closeDate.$lte = end;
      }
    }

    // Build sort
    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    console.log('🔍 Filter applied:', JSON.stringify(filter));
    
    // Get successful leads with population
    const successfulLeads = await SuccessfulLead.find(filter)
      .populate({
        path: 'assigned',
        select: 'login',
        options: { strictPopulate: false }
      })
      .populate({
        path: 'leadId',
        select: 'name phone email department sourceDescription',
        options: { strictPopulate: false }
      })
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    const total = await SuccessfulLead.countDocuments(filter);

    console.log('📊 Found successful leads:', successfulLeads.length, 'Total:', total);

    res.json({
      success: true,
      data: successfulLeads,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit))
      }
    });

  } catch (error) {
    console.error('Error fetching successful leads:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка при получении успешных лидов',
      error: error.message
    });
  }
});

// GET /api/successful-leads/:id - Get successful lead by ID
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Некорректный ID'
      });
    }

    const successfulLead = await SuccessfulLead.findById(id)
      .populate({
        path: 'assigned',
        select: 'login',
        options: { strictPopulate: false }
      })
      .populate({
        path: 'leadId',
        select: 'name phone email department sourceDescription',
        options: { strictPopulate: false }
      })
      .lean();

    if (!successfulLead) {
      return res.status(404).json({
        success: false,
        message: 'Успешный лид не найден'
      });
    }

    res.json({
      success: true,
      data: successfulLead
    });

  } catch (error) {
    console.error('Error fetching successful lead:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка при получении успешного лида',
      error: error.message
    });
  }
});

// GET /api/successful-leads/stats/by-manager - Get stats by manager
router.get('/stats/by-manager', authenticateToken, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: 'Необходимо указать startDate и endDate'
      });
    }

    const stats = await SuccessfulLead.getStatsByManager(startDate, endDate);

    res.json({
      success: true,
      data: stats
    });

  } catch (error) {
    console.error('Error fetching stats by manager:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка при получении статистики по менеджерам',
      error: error.message
    });
  }
});

// GET /api/successful-leads/stats/by-period - Get stats by period
router.get('/stats/by-period', authenticateToken, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: 'Необходимо указать startDate и endDate'
      });
    }

    const stats = await SuccessfulLead.getStatsByPeriod(startDate, endDate);

    res.json({
      success: true,
      data: stats.length > 0 ? stats[0] : {
        totalAmount: 0,
        totalLeads: 0,
        avgAmount: 0
      }
    });

  } catch (error) {
    console.error('Error fetching stats by period:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка при получении статистики за период',
      error: error.message
    });
  }
});

// DELETE /api/successful-leads/:id - Delete successful lead
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Некорректный ID'
      });
    }

    const successfulLead = await SuccessfulLead.findByIdAndDelete(id);

    if (!successfulLead) {
      return res.status(404).json({
        success: false,
        message: 'Успешный лид не найден'
      });
    }

    res.json({
      success: true,
      message: 'Успешный лид удален'
    });

  } catch (error) {
    console.error('Error deleting successful lead:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка при удалении успешного лида',
      error: error.message
    });
  }
});

module.exports = router;
