const express = require('express');
const router = express.Router();
const Action = require('../models/Actions');
const mongoose = require('mongoose');
const { authenticateToken } = require('../middleware/auth');

// GET /api/actions - Get all actions
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { 
      leadId, 
      managerId, 
      sortBy = 'planDate', 
      sortOrder = 'asc',
      page = 1,
      limit = 50
    } = req.query;
    
    // Build filter
    const filter = {};
    if (leadId) {
      if (!mongoose.Types.ObjectId.isValid(leadId)) {
        return res.status(400).json({
          success: false,
          message: 'Некорректный ID лида'
        });
      }
      filter.leadId = leadId;
    }
    if (managerId) {
      if (!mongoose.Types.ObjectId.isValid(managerId)) {
        return res.status(400).json({
          success: false,
          message: 'Некорректный ID менеджера'
        });
      }
      filter.managerId = managerId;
    }

    // Build sort
    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Get actions with population
    const actions = await Action.find(filter)
      .populate('leadId', 'name phone email')
      .populate('managerId', 'login')
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit));

    // Get total count for pagination
    const totalCount = await Action.countDocuments(filter);

    res.json({
      success: true,
      data: actions,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: totalCount,
        pages: Math.ceil(totalCount / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Error fetching actions:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка при получении действий'
    });
  }
});

// GET /api/actions/overdue - Get overdue actions
router.get('/overdue', authenticateToken, async (req, res) => {
  try {
    const { managerId } = req.query;
    
    const filter = {
      planDate: { $lt: new Date() }
    };
    
    if (managerId) {
      if (!mongoose.Types.ObjectId.isValid(managerId)) {
        return res.status(400).json({
          success: false,
          message: 'Некорректный ID менеджера'
        });
      }
      filter.managerId = managerId;
    }

    const actions = await Action.find(filter)
      .populate('leadId', 'name phone email')
      .populate('managerId', 'login')
      .sort({ planDate: 1 });

    res.json({
      success: true,
      data: actions,
      count: actions.length
    });
  } catch (error) {
    console.error('Error fetching overdue actions:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка при получении просроченных действий'
    });
  }
});

// GET /api/actions/today - Get today's actions
router.get('/today', authenticateToken, async (req, res) => {
  try {
    const { managerId } = req.query;
    
    const today = new Date();
    const startOfDay = new Date(today.setHours(0, 0, 0, 0));
    const endOfDay = new Date(today.setHours(23, 59, 59, 999));
    
    const filter = {
      planDate: { $gte: startOfDay, $lte: endOfDay }
    };
    
    if (managerId) {
      if (!mongoose.Types.ObjectId.isValid(managerId)) {
        return res.status(400).json({
          success: false,
          message: 'Некорректный ID менеджера'
        });
      }
      filter.managerId = managerId;
    }

    const actions = await Action.find(filter)
      .populate('leadId', 'name phone email')
      .populate('managerId', 'login')
      .sort({ planDate: 1 });

    res.json({
      success: true,
      data: actions,
      count: actions.length
    });
  } catch (error) {
    console.error('Error fetching today actions:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка при получении действий на сегодня'
    });
  }
});

// GET /api/actions/:id - Get action by ID
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Некорректный ID действия'
      });
    }

    const action = await Action.findById(id)
      .populate('leadId', 'name phone email')
      .populate('managerId', 'login');

    if (!action) {
      return res.status(404).json({
        success: false,
        message: 'Действие не найдено'
      });
    }

    res.json({
      success: true,
      data: action
    });
  } catch (error) {
    console.error('Error fetching action:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка при получении действия'
    });
  }
});

// POST /api/actions - Create new action
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { title, description, planDate, leadId, managerId } = req.body;

    // Validation
    if (!title || !title.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Заголовок обязателен'
      });
    }

    if (!planDate) {
      return res.status(400).json({
        success: false,
        message: 'Дата планирования обязательна'
      });
    }

    if (!leadId || !mongoose.Types.ObjectId.isValid(leadId)) {
      return res.status(400).json({
        success: false,
        message: 'Некорректный ID лида'
      });
    }

    if (!managerId || !mongoose.Types.ObjectId.isValid(managerId)) {
      return res.status(400).json({
        success: false,
        message: 'Некорректный ID менеджера'
      });
    }

    // Create action
    const action = new Action({
      title: title.trim(),
      description: description ? description.trim() : '',
      planDate: new Date(planDate),
      leadId,
      managerId
    });

    await action.save();

    // Populate and return
    const populatedAction = await Action.findById(action._id)
      .populate('leadId', 'name phone email')
      .populate('managerId', 'login');

    res.status(201).json({
      success: true,
      data: populatedAction,
      message: 'Действие успешно создано'
    });
  } catch (error) {
    console.error('Error creating action:', error);
    
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        message: 'Ошибка валидации данных',
        errors: Object.values(error.errors).map(err => err.message)
      });
    }

    res.status(500).json({
      success: false,
      message: 'Ошибка при создании действия'
    });
  }
});

// PUT /api/actions/:id - Update action
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, planDate, leadId, managerId } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Некорректный ID действия'
      });
    }

    // Find action
    const action = await Action.findById(id);
    if (!action) {
      return res.status(404).json({
        success: false,
        message: 'Действие не найдено'
      });
    }

    // Validation
    if (title !== undefined) {
      if (!title || !title.trim()) {
        return res.status(400).json({
          success: false,
          message: 'Заголовок не может быть пустым'
        });
      }
      action.title = title.trim();
    }

    if (description !== undefined) {
      action.description = description ? description.trim() : '';
    }

    if (planDate !== undefined) {
      if (!planDate) {
        return res.status(400).json({
          success: false,
          message: 'Дата планирования обязательна'
        });
      }
      action.planDate = new Date(planDate);
    }

    if (leadId !== undefined) {
      if (!mongoose.Types.ObjectId.isValid(leadId)) {
        return res.status(400).json({
          success: false,
          message: 'Некорректный ID лида'
        });
      }
      action.leadId = leadId;
    }

    if (managerId !== undefined) {
      if (!mongoose.Types.ObjectId.isValid(managerId)) {
        return res.status(400).json({
          success: false,
          message: 'Некорректный ID менеджера'
        });
      }
      action.managerId = managerId;
    }

    await action.save();

    // Populate and return
    const populatedAction = await Action.findById(action._id)
      .populate('leadId', 'name phone email')
      .populate('managerId', 'login');

    res.json({
      success: true,
      data: populatedAction,
      message: 'Действие успешно обновлено'
    });
  } catch (error) {
    console.error('Error updating action:', error);
    
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        message: 'Ошибка валидации данных',
        errors: Object.values(error.errors).map(err => err.message)
      });
    }

    res.status(500).json({
      success: false,
      message: 'Ошибка при обновлении действия'
    });
  }
});

// DELETE /api/actions/:id - Delete action
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Некорректный ID действия'
      });
    }

    const action = await Action.findById(id);
    if (!action) {
      return res.status(404).json({
        success: false,
        message: 'Действие не найдено'
      });
    }

    await Action.findByIdAndDelete(id);

    res.json({
      success: true,
      message: 'Действие успешно удалено'
    });
  } catch (error) {
    console.error('Error deleting action:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка при удалении действия'
    });
  }
});

// DELETE /api/actions/bulk/delete - Bulk delete actions
router.delete('/bulk/delete', authenticateToken, async (req, res) => {
  try {
    const { ids } = req.body;
    
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Не указаны ID действий для удаления'
      });
    }

    // Validate all IDs
    const invalidIds = ids.filter(id => !mongoose.Types.ObjectId.isValid(id));
    if (invalidIds.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Некорректные ID действий'
      });
    }

    const result = await Action.deleteMany({ _id: { $in: ids } });

    res.json({
      success: true,
      message: `Удалено действий: ${result.deletedCount}`,
      deletedCount: result.deletedCount
    });
  } catch (error) {
    console.error('Error bulk deleting actions:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка при массовом удалении действий'
    });
  }
});

module.exports = router;
