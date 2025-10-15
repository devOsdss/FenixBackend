const express = require('express');
const Lead = require('../../models/Lead');
const router = express.Router();
const { authenticateToken } = require('../../middleware/auth');
const { isValidObjectId } = require('../../utils/leadHelpers');

/**
 * @route DELETE /api/leads/bulk/delete
 * @desc Bulk delete leads
 * @access Private
 */
router.delete('/delete', authenticateToken, async (req, res) => {
  try {
    const { ids } = req.body;
    
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Необхідно передати масив ID для видалення'
      });
    }

    // Validate all IDs
    const invalidIds = ids.filter(id => !isValidObjectId(id));
    if (invalidIds.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Знайдено невірні ID',
        invalidIds
      });
    }

    const result = await Lead.deleteMany({
      _id: { $in: ids }
    });

    res.json({
      success: true,
      message: `Успішно видалено ${result.deletedCount} лідів`,
      deletedCount: result.deletedCount
    });
  } catch (error) {
    console.error('Error bulk deleting leads:', error);
    res.status(500).json({
      success: false,
      message: 'Помилка при масовому видаленні лідів',
      error: error.message
    });
  }
});

/**
 * @route PATCH /api/leads/bulk/status
 * @desc Bulk update lead status
 * @access Private
 */
router.patch('/status', authenticateToken, async (req, res) => {
  try {
    const { ids, status } = req.body;
    
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Необхідно передати масив ID'
      });
    }

    if (!status || status.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Необхідно вказати статус'
      });
    }

    // Validate all IDs
    const invalidIds = ids.filter(id => !isValidObjectId(id));
    if (invalidIds.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Знайдено невірні ID',
        invalidIds
      });
    }

    const result = await Lead.updateMany(
      { _id: { $in: ids } },
      { $set: { status: status.trim() } }
    );

    res.json({
      success: true,
      message: `Статус оновлено для ${result.modifiedCount} лідів`,
      modifiedCount: result.modifiedCount
    });
  } catch (error) {
    console.error('Error bulk updating status:', error);
    res.status(500).json({
      success: false,
      message: 'Помилка при масовому оновленні статусу',
      error: error.message
    });
  }
});

/**
 * @route PATCH /api/leads/bulk/assign
 * @desc Bulk assign leads to manager
 * @access Private
 */
router.patch('/assign', authenticateToken, async (req, res) => {
  try {
    const { ids, assigned } = req.body;
    
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Необхідно передати масив ID'
      });
    }

    if (!assigned || !isValidObjectId(assigned)) {
      return res.status(400).json({
        success: false,
        message: 'Необхідно вказати валідний ID менеджера'
      });
    }

    // Validate all IDs
    const invalidIds = ids.filter(id => !isValidObjectId(id));
    if (invalidIds.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Знайдено невірні ID',
        invalidIds
      });
    }

    const result = await Lead.updateMany(
      { _id: { $in: ids } },
      { $set: { assigned } }
    );

    res.json({
      success: true,
      message: `Призначено ${result.modifiedCount} лідів`,
      modifiedCount: result.modifiedCount
    });
  } catch (error) {
    console.error('Error bulk assigning leads:', error);
    res.status(500).json({
      success: false,
      message: 'Помилка при масовому призначенні лідів',
      error: error.message
    });
  }
});

/**
 * @route PATCH /api/leads/bulk/hide
 * @desc Bulk hide/unhide leads
 * @access Private
 */
router.patch('/hide', authenticateToken, async (req, res) => {
  try {
    const { ids, hidden = true } = req.body;
    
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Необхідно передати масив ID'
      });
    }

    // Validate all IDs
    const invalidIds = ids.filter(id => !isValidObjectId(id));
    if (invalidIds.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Знайдено невірні ID',
        invalidIds
      });
    }

    const result = await Lead.updateMany(
      { _id: { $in: ids } },
      { $set: { hidden: Boolean(hidden) } }
    );

    const action = hidden ? 'приховано' : 'відновлено';
    res.json({
      success: true,
      message: `${result.modifiedCount} лідів ${action}`,
      modifiedCount: result.modifiedCount
    });
  } catch (error) {
    console.error('Error bulk hiding leads:', error);
    res.status(500).json({
      success: false,
      message: 'Помилка при масовій зміні видимості лідів',
      error: error.message
    });
  }
});

module.exports = router;
