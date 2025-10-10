const express = require('express');
const router = express.Router();
const Status = require('../models/Statuses');
const { authenticateToken } = require('../middleware/auth');

// GET /api/statuses - Get all statuses
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { active, sortBy = 'sortOrder', sortOrder = 'asc' } = req.query;
    
    // Build filter
    const filter = {};
    if (active !== undefined) {
      filter.isActive = active === 'true';
    }

    // Build sort
    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    const statuses = await Status.find(filter).sort(sort);
    
    res.json({
      success: true,
      data: statuses,
      count: statuses.length
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

// GET /api/statuses/options - Get status options for frontend dropdowns
router.get('/options', authenticateToken, async (req, res) => {
  try {
    const options = await Status.getStatusOptions();
    
    res.json({
      success: true,
      data: options
    });
  } catch (error) {
    console.error('Error fetching status options:', error);
    res.status(500).json({
      success: false,
      message: 'Помилка при отриманні опцій статусів',
      error: error.message
    });
  }
});

// GET /api/statuses/:id - Get single status by ID
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const status = await Status.findById(req.params.id);
    
    if (!status) {
      return res.status(404).json({
        success: false,
        message: 'Статус не знайдено'
      });
    }

    res.json({
      success: true,
      data: status
    });
  } catch (error) {
    console.error('Error fetching status:', error);
    res.status(500).json({
      success: false,
      message: 'Помилка при отриманні статусу',
      error: error.message
    });
  }
});

// GET /api/statuses/value/:value - Get status by value
router.get('/value/:value', authenticateToken, async (req, res) => {
  try {
    const status = await Status.getByValue(req.params.value);
    
    if (!status) {
      return res.status(404).json({
        success: false,
        message: 'Статус не знайдено'
      });
    }

    res.json({
      success: true,
      data: status
    });
  } catch (error) {
    console.error('Error fetching status by value:', error);
    res.status(500).json({
      success: false,
      message: 'Помилка при отриманні статусу',
      error: error.message
    });
  }
});

// POST /api/statuses - Create new status
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { value, label, color, roleView, description, isActive = true, sortOrder = 0 } = req.body;

    // Validate required fields
    if (!value || !label || !color) {
      return res.status(400).json({
        success: false,
        message: 'Обов\'язкові поля: value, label, color'
      });
    }

    // Check if status with this value already exists
    const existingStatus = await Status.findOne({ value: value.toUpperCase() });
    if (existingStatus) {
      return res.status(400).json({
        success: false,
        message: 'Статус з таким значенням вже існує'
      });
    }

    // Create new status
    const status = new Status({
      value,
      label,
      color,
      roleView,
      description,
      isActive,
      sortOrder
    });

    await status.save();

    res.status(201).json({
      success: true,
      data: status,
      message: 'Статус успішно створено'
    });
  } catch (error) {
    console.error('Error creating status:', error);
    
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        message: 'Помилка валідації',
        errors: Object.values(error.errors).map(err => err.message)
      });
    }

    res.status(500).json({
      success: false,
      message: 'Помилка при створенні статусу',
      error: error.message
    });
  }
});

// PUT /api/statuses/:id - Update status
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { value, label, color, description, isActive, sortOrder } = req.body;

    // Find status
    const status = await Status.findById(req.params.id);
    if (!status) {
      return res.status(404).json({
        success: false,
        message: 'Статус не знайдено'
      });
    }

    // Check if value is being changed and if new value already exists
    if (value && value.toUpperCase() !== status.value) {
      const existingStatus = await Status.findOne({ 
        value: value.toUpperCase(),
        _id: { $ne: req.params.id }
      });
      if (existingStatus) {
        return res.status(400).json({
          success: false,
          message: 'Статус з таким значенням вже існує'
        });
      }
    }

    // Update fields
    if (value !== undefined) status.value = value;
    if (label !== undefined) status.label = label;
    if (color !== undefined) status.color = color;
    if (description !== undefined) status.description = description;
    if (isActive !== undefined) status.isActive = isActive;
    if (sortOrder !== undefined) status.sortOrder = sortOrder;

    await status.save();

    res.json({
      success: true,
      data: status,
      message: 'Статус успішно оновлено'
    });
  } catch (error) {
    console.error('Error updating status:', error);
    
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        message: 'Помилка валідації',
        errors: Object.values(error.errors).map(err => err.message)
      });
    }

    res.status(500).json({
      success: false,
      message: 'Помилка при оновленні статусу',
      error: error.message
    });
  }
});

// DELETE /api/statuses/:id - Delete status
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const status = await Status.findById(req.params.id);
    
    if (!status) {
      return res.status(404).json({
        success: false,
        message: 'Статус не знайдено'
      });
    }

    // Check if status is being used by any leads
    const Lead = require('../models/Lead');
    const leadsCount = await Lead.countDocuments({ status: status.value });
    
    if (leadsCount > 0) {
      return res.status(400).json({
        success: false,
        message: `Неможливо видалити статус. Він використовується у ${leadsCount} лідів`,
        leadsCount
      });
    }

    await Status.findByIdAndDelete(req.params.id);

    res.json({
      success: true,
      message: 'Статус успішно видалено'
    });
  } catch (error) {
    console.error('Error deleting status:', error);
    res.status(500).json({
      success: false,
      message: 'Помилка при видаленні статусу',
      error: error.message
    });
  }
});

// PATCH /api/statuses/:id/toggle - Toggle status active state
router.patch('/:id/toggle', authenticateToken, async (req, res) => {
  try {
    const status = await Status.findById(req.params.id);
    
    if (!status) {
      return res.status(404).json({
        success: false,
        message: 'Статус не знайдено'
      });
    }

    status.isActive = !status.isActive;
    await status.save();

    res.json({
      success: true,
      data: status,
      message: `Статус ${status.isActive ? 'активовано' : 'деактивовано'}`
    });
  } catch (error) {
    console.error('Error toggling status:', error);
    res.status(500).json({
      success: false,
      message: 'Помилка при зміні статусу',
      error: error.message
    });
  }
});

// POST /api/statuses/validate - Validate status value
router.post('/validate', authenticateToken, async (req, res) => {
  try {
    const { value } = req.body;
    
    if (!value) {
      return res.status(400).json({
        success: false,
        message: 'Значення статусу обов\'язкове'
      });
    }

    const isValid = await Status.isValidStatus(value);
    
    res.json({
      success: true,
      isValid,
      message: isValid ? 'Статус валідний' : 'Статус не знайдено або неактивний'
    });
  } catch (error) {
    console.error('Error validating status:', error);
    res.status(500).json({
      success: false,
      message: 'Помилка при валідації статусу',
      error: error.message
    });
  }
});

// POST /api/statuses/bulk - Bulk operations
router.post('/bulk', authenticateToken, async (req, res) => {
  try {
    const { operation, ids, data } = req.body;
    
    if (!operation || !ids || !Array.isArray(ids)) {
      return res.status(400).json({
        success: false,
        message: 'Обов\'язкові поля: operation, ids (array)'
      });
    }

    let result;
    
    switch (operation) {
      case 'activate':
        result = await Status.updateMany(
          { _id: { $in: ids } },
          { isActive: true }
        );
        break;
        
      case 'deactivate':
        result = await Status.updateMany(
          { _id: { $in: ids } },
          { isActive: false }
        );
        break;
        
      case 'delete':
        // Check if any of these statuses are being used
        const statusValues = await Status.find({ _id: { $in: ids } }).select('value');
        const Lead = require('../models/Lead');
        const leadsCount = await Lead.countDocuments({ 
          status: { $in: statusValues.map(s => s.value) }
        });
        
        if (leadsCount > 0) {
          return res.status(400).json({
            success: false,
            message: `Неможливо видалити статуси. Вони використовуються у ${leadsCount} лідів`
          });
        }
        
        result = await Status.deleteMany({ _id: { $in: ids } });
        break;
        
      case 'update':
        if (!data) {
          return res.status(400).json({
            success: false,
            message: 'Дані для оновлення обов\'язкові'
          });
        }
        result = await Status.updateMany(
          { _id: { $in: ids } },
          data
        );
        break;
        
      default:
        return res.status(400).json({
          success: false,
          message: 'Невідома операція. Доступні: activate, deactivate, delete, update'
        });
    }

    res.json({
      success: true,
      data: result,
      message: `Операція "${operation}" виконана для ${result.modifiedCount || result.deletedCount} статусів`
    });
  } catch (error) {
    console.error('Error in bulk operation:', error);
    res.status(500).json({
      success: false,
      message: 'Помилка при виконанні групової операції',
      error: error.message
    });
  }
});

module.exports = router;
