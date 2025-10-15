const express = require('express');
const Lead = require('../../models/Lead');
const router = express.Router();
const { authenticateToken } = require('../../middleware/auth');
const { isValidObjectId } = require('../../utils/leadHelpers');
const {
  logLeadCreated,
  logStatusChanged,
  logAssignmentChanged,
  logCommentAdded,
  logLeadUpdated,
  logContactInfoUpdated,
  logLeadHidden,
  logLeadUnhidden
} = require('../../utils/historyLogger');

/**
 * @route GET /api/leads/:id
 * @desc Get lead by ID
 * @access Private
 */
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: 'Невірний формат ID'
      });
    }

    const lead = await Lead.findById(id).lean();
    
    if (!lead) {
      return res.status(404).json({
        success: false,
        message: 'Лід не знайдено'
      });
    }

    res.json({
      success: true,
      data: lead
    });
  } catch (error) {
    console.error('Error fetching lead:', error);
    res.status(500).json({
      success: false,
      message: 'Помилка при отриманні ліда',
      error: error.message
    });
  }
});

/**
 * @route POST /api/leads
 * @desc Create new lead
 * @access Private
 */
router.post('/', authenticateToken, async (req, res) => {
  try {
    const leadData = req.body;
    
    // Normalize phone number for search
    if (leadData.phone) {
      leadData.normalizedPhone = leadData.phone.replace(/\D/g, '');
    }
    
    // Set default values
    leadData.dateCreate = leadData.dateCreate || new Date();
    leadData.status = leadData.status || 'NEW';
    
    const newLead = new Lead(leadData);
    const savedLead = await newLead.save();
    
    // Log lead creation
    await logLeadCreated(savedLead._id, req.admin._id, {
      name: savedLead.name,
      phone: savedLead.phone,
      email: savedLead.email,
      status: savedLead.status
    });

    res.status(201).json({
      success: true,
      data: savedLead,
      message: 'Лід успішно створено'
    });
  } catch (error) {
    console.error('Error creating lead:', error);
    
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Лід з таким телефоном вже існує'
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Помилка при створенні ліда',
      error: error.message
    });
  }
});

/**
 * @route PUT /api/leads/:id
 * @desc Update lead by ID
 * @access Private
 */
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    
    if (!isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: 'Невірний формат ID'
      });
    }

    // Get original lead for comparison
    const originalLead = await Lead.findById(id);
    if (!originalLead) {
      return res.status(404).json({
        success: false,
        message: 'Лід не знайдено'
      });
    }

    // Normalize phone if updated
    if (updateData.phone) {
      updateData.normalizedPhone = updateData.phone.replace(/\D/g, '');
    }

    const updatedLead = await Lead.findByIdAndUpdate(
      id,
      { $set: updateData },
      { new: true, runValidators: true }
    );

    // Log specific changes
    if (originalLead.status !== updatedLead.status) {
      await logStatusChanged(id, req.admin._id, originalLead.status, updatedLead.status);
    }
    
    if (originalLead.assigned !== updatedLead.assigned) {
      await logAssignmentChanged(id, req.admin._id, originalLead.assigned, updatedLead.assigned);
    }
    
    if (originalLead.phone !== updatedLead.phone || originalLead.email !== updatedLead.email) {
      await logContactInfoUpdated(id, req.admin._id, {
        oldPhone: originalLead.phone,
        newPhone: updatedLead.phone,
        oldEmail: originalLead.email,
        newEmail: updatedLead.email
      });
    }

    // Log general update
    await logLeadUpdated(id, req.admin._id, updateData);

    res.json({
      success: true,
      data: updatedLead,
      message: 'Лід успішно оновлено'
    });
  } catch (error) {
    console.error('Error updating lead:', error);
    
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Лід з таким телефоном вже існує'
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Помилка при оновленні ліда',
      error: error.message
    });
  }
});

/**
 * @route DELETE /api/leads/:id
 * @desc Delete lead by ID
 * @access Private
 */
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: 'Невірний формат ID'
      });
    }

    const deletedLead = await Lead.findByIdAndDelete(id);
    
    if (!deletedLead) {
      return res.status(404).json({
        success: false,
        message: 'Лід не знайдено'
      });
    }

    res.json({
      success: true,
      message: 'Лід успішно видалено'
    });
  } catch (error) {
    console.error('Error deleting lead:', error);
    res.status(500).json({
      success: false,
      message: 'Помилка при видаленні ліда',
      error: error.message
    });
  }
});

/**
 * @route PATCH /api/leads/:id/visibility
 * @desc Toggle lead visibility (hide/unhide)
 * @access Private
 */
router.patch('/:id/visibility', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: 'Невірний формат ID'
      });
    }

    const lead = await Lead.findById(id);
    if (!lead) {
      return res.status(404).json({
        success: false,
        message: 'Лід не знайдено'
      });
    }

    const newHiddenState = !lead.hidden;
    const updatedLead = await Lead.findByIdAndUpdate(
      id,
      { hidden: newHiddenState },
      { new: true }
    );

    // Log visibility change
    if (newHiddenState) {
      await logLeadHidden(id, req.admin._id);
    } else {
      await logLeadUnhidden(id, req.admin._id);
    }

    res.json({
      success: true,
      data: updatedLead,
      message: newHiddenState ? 'Лід приховано' : 'Лід відновлено'
    });
  } catch (error) {
    console.error('Error toggling lead visibility:', error);
    res.status(500).json({
      success: false,
      message: 'Помилка при зміні видимості ліда',
      error: error.message
    });
  }
});

/**
 * @route POST /api/leads/:id/comments
 * @desc Add comment to lead
 * @access Private
 */
router.post('/:id/comments', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { comment, photo } = req.body;
    
    if (!isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: 'Невірний формат ID'
      });
    }

    if (!comment || comment.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Коментар не може бути порожнім'
      });
    }

    const lead = await Lead.findById(id);
    if (!lead) {
      return res.status(404).json({
        success: false,
        message: 'Лід не знайдено'
      });
    }

    const newComment = {
      comment: comment.trim(),
      photo: photo || null,
      date: new Date(),
      author: req.admin._id
    };

    lead.comments = lead.comments || [];
    lead.comments.push(newComment);
    
    await lead.save();

    // Log comment addition
    await logCommentAdded(id, req.admin._id, comment.trim());

    res.json({
      success: true,
      data: newComment,
      message: 'Коментар додано'
    });
  } catch (error) {
    console.error('Error adding comment:', error);
    res.status(500).json({
      success: false,
      message: 'Помилка при додаванні коментаря',
      error: error.message
    });
  }
});

module.exports = router;
