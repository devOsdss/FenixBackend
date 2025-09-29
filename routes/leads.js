const express = require('express');
const Lead = require('../models/Lead');
const router = express.Router();
const { Types } = require('mongoose');
const { authenticateToken } = require('../middleware/auth');
const {
  logLeadCreated,
  logStatusChanged,
  logAssignmentChanged,
  logCommentAdded,
  logLeadUpdated,
  logContactInfoUpdated,
  logLeadHidden,
  logLeadUnhidden
} = require('../utils/historyLogger');

// Helper function to escape regex special characters
function escapeRegex(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Helper function to create phone search conditions
function createPhoneSearchConditions(search) {
  // Escape regex special characters in search string
  const escapedSearch = escapeRegex(search);
  
  // Normalize phone search query by removing all non-digit characters
  const normalizedSearch = search.replace(/\D/g, '');
  
  const searchConditions = [
    { name: { $regex: escapedSearch, $options: 'i' } },
    { email: { $regex: escapedSearch, $options: 'i' } }
  ];
  
  // Add phone search conditions
  if (normalizedSearch.length > 0) {
    // Primary search: normalized phone (digits only) - this enables cross-format matching
    // Use both exact match and partial match for better results
    searchConditions.push({ normalizedPhone: { $regex: normalizedSearch, $options: 'i' } });
    
    // Also try exact match for full numbers
    if (normalizedSearch.length >= 7) {
      searchConditions.push({ normalizedPhone: normalizedSearch });
    }
    
    // Secondary search: original phone field for exact format matches
    searchConditions.push({ phone: { $regex: escapedSearch, $options: 'i' } });
  } else {
    // If no digits in search, only search original phone field and name/email
    searchConditions.push({ phone: { $regex: escapedSearch, $options: 'i' } });
  }
  
  return searchConditions;
}

// Get all unique statuses from leads
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

// Get all unique UTM sources from leads
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

// Get all leads with pagination and filtering
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 20, 
      status, 
      assigned, 
      search,
      hidden,
      department,
      sourceDescription,
      utm_source,
      dateFrom,
      dateTo,
      sortBy = 'dateCreate',
      sortOrder = 'desc',
      userRole,
      userTeam,
      userId
    } = req.query;
     console.log("userTeam", userTeam)
    const filter = {};
    
    if (hidden !== undefined) {
      filter.hidden = hidden === 'true';
    }

    // Role-based filtering
    if (userRole && userId) {
      if (userRole === 'Manager' || userRole === 'Reten') {
        // Manager/Reten can only see leads assigned to them
        filter.assigned = userId;
      } else if (userRole === 'TeamLead') {
        const Admin = require('../models/Admin');
        const teamMembers = await Admin.find({ team: userTeam }, '_id');
        const teamMemberIds = teamMembers.map(admin => admin._id.toString());
        teamMemberIds.push(userTeam);
        console.log("teamMemberIds", teamMemberIds)
        filter.assigned = { $in: teamMemberIds };
      }
    }
    
    // Advanced status handling: statusMode + statuses
    const { statusMode, statuses } = req.query;
    if (statusMode && typeof statuses === 'string' && statuses.trim().length > 0) {
      const list = statuses.split(',').map(s => s.trim()).filter(Boolean);
      if (statusMode === 'other') {
        filter.status = { $nin: list };
      } else if (statusMode === 'only') {
        filter.status = { $in: list };
      }
    } else if (status) {
      if (Array.isArray(status)) {
        filter.status = { $in: status };
        console.log('🔍 Status filter (array):', status);
      } else if (typeof status === 'string' && status.includes(',')) {
        const statusArray = status.split(',');
        filter.status = { $in: statusArray };
        console.log('🔍 Status filter (comma-separated):', statusArray);
      } else {
        filter.status = status;
        console.log('🔍 Status filter (single):', status);
      }
    }
    if (assigned) {
      if (Array.isArray(assigned)) {
        filter.assigned = { $in: assigned };
      } else if (typeof assigned === 'string' && assigned.includes(',')) {
        filter.assigned = { $in: assigned.split(',') };
      } else {
        filter.assigned = assigned;
      }
    }

    if (search) {
      filter.$or = createPhoneSearchConditions(search);
    }

    if (department) {
      filter.department = department;
      console.log("Department filter applied:", department);
    }

    if (sourceDescription) {
      filter.sourceDescription = { $regex: sourceDescription, $options: 'i' };
    }

    if (utm_source) {
      // Replace + with spaces for UTM source matching (URL encoding issue)
      const normalizedUtmSource = utm_source.replace(/\+/g, ' ');
      filter.utm_source = { $regex: escapeRegex(normalizedUtmSource), $options: 'i' };
    }

    if (dateFrom || dateTo) {
      filter.dateCreate = {};
      if (dateFrom) {
        filter.dateCreate.$gte = new Date(dateFrom);
      }
      if (dateTo) {
        const endDate = new Date(dateTo);
        endDate.setHours(23, 59, 59, 999);
        filter.dateCreate.$lte = endDate;
      }
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    console.log('📋 Final filter object:', JSON.stringify(filter, null, 2));
    
    // Get total count for pagination
    const total = await Lead.countDocuments(filter);
    console.log('📊 Total leads matching filter:', total);
    
    // If assigned filter is set, let's check what leads exist with those IDs
    if (filter.assigned) {
      let assignedQuery = {};
      if (filter.assigned.$in) {
        assignedQuery = { assigned: { $in: filter.assigned.$in } };
      } else {
        assignedQuery = { assigned: filter.assigned };
      }
      const assignedCheck = await Lead.find(assignedQuery, 'name assigned').limit(5);
      console.log('🔍 Sample leads with assigned filter:', assignedCheck.map(l => ({ name: l.name, assigned: l.assigned })));
      
      // Also check total count for assigned filter alone
      const assignedTotal = await Lead.countDocuments(assignedQuery);
      console.log('🔍 Total leads with this assigned filter:', assignedTotal);
    }
    
    // Get leads with pagination
    const leads = await Lead.find(filter)
      .sort({ [sortBy]: sortOrder === 'desc' ? -1 : 1 })
      .skip((parseInt(page) - 1) * parseInt(limit))
      .limit(parseInt(limit));
      
    console.log('👥 Found leads:', leads.length);
    
    let statusCounts = {};
    if (status && (Array.isArray(status) || (typeof status === 'string' && status.includes(',')))) {
      const statusArray = Array.isArray(status) ? status : status.split(',');
      const statusCountsAggregation = await Lead.aggregate([
        { $match: filter },
        { $group: { _id: '$status', count: { $sum: 1 } } }
      ]);
      
      statusCountsAggregation.forEach(item => {
        statusCounts[item._id] = item.count;
      });
      
      statusArray.forEach(s => {
        if (!statusCounts[s]) {
          statusCounts[s] = 0;
        }
      });
    }
    
    res.json({
      success: true,
      data: leads,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / parseInt(limit)),
        total: total,
        limit: parseInt(limit)
      },
      statusCounts: statusCounts
    });

  } catch (error) {
    console.error('Get leads error:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка при получении лидов'
    });
  }
});

// Get single lead by ID
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const lead = await Lead.findById(req.params.id);
    
    if (!lead) {
      return res.status(404).json({
        success: false,
        message: 'Лид не найден'
      });
    }
    
    res.json({
      success: true,
      data: lead
    });

  } catch (error) {
    console.error('Get lead error:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка при получении лида'
    });
  }
});

// Create new lead
router.post('/', authenticateToken, async (req, res) => {
  try {
    const leadData = req.body;
    
    // Check if lead with this phone already exists
    const existingLead = await Lead.findByPhone(leadData.phone);
    if (existingLead) {
      return res.status(409).json({
        success: false,
        message: 'Лид с таким телефоном уже существует'
      });
    }
    
    const newLead = new Lead(leadData);
    await newLead.save();
    
    // Log lead creation to history
    const adminId = req.body.adminId || req.headers['x-admin-id'];
    if (adminId) {
      await logLeadCreated(newLead._id, adminId, {
        name: newLead.name,
        phone: newLead.phone,
        status: newLead.status,
        sourceDescription: newLead.sourceDescription,
        utm_source: newLead.utm_source
      });
    }
    
    res.status(201).json({
      success: true,
      message: 'Лид успешно создан',
      data: newLead
    });

  } catch (error) {
    console.error('Create lead error:', error);
    
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: messages.join(', ')
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Ошибка при создании лида'
    });
  }
});

// Bulk delete leads
router.delete('/bulk/delete', authenticateToken, async (req, res) => {
  try {
    const { leadIds } = req.body;
    
    if (!leadIds || !Array.isArray(leadIds) || leadIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Не передано ідентифікатори лідів для видалення'
      });
    }

    // Validate ObjectIds
    const validIds = leadIds.filter(id => Types.ObjectId.isValid(id));
    if (validIds.length !== leadIds.length) {
      return res.status(400).json({
        success: false,
        message: 'Деякі ідентифікатори лідів мають невірний формат'
      });
    }

    // Check if leads exist
    const existingLeads = await Lead.find({ _id: { $in: validIds } });
    if (existingLeads.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Ліди не знайдені'
      });
    }

    // Delete leads
    const result = await Lead.deleteMany({ _id: { $in: validIds } });
    
    res.json({
      success: true,
      message: `Успішно видалено ${result.deletedCount} лідів`,
      deletedCount: result.deletedCount,
      requestedCount: leadIds.length
    });

  } catch (error) {
    console.error('Bulk delete leads error:', error);
    res.status(500).json({
      success: false,
      message: 'Помилка при видаленні лідів',
      error: error.message
    });
  }
});

// Bulk update leads
router.put('/bulk', authenticateToken, async (req, res) => {
  try {
    console.log('Backend - Bulk update request received:', {
      body: req.body,
      hasAuth: !!req.headers.authorization
    });
    
    const { leadIds, updateData } = req.body;
    
    if (!leadIds || !Array.isArray(leadIds) || leadIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Не передано ідентифікатори лідів для оновлення'
      });
    }

    if (!updateData || typeof updateData !== 'object') {
      return res.status(400).json({
        success: false,
        message: 'Не передано дані для оновлення'
      });
    }

    // Validate ObjectIds
    const validIds = leadIds.filter(id => Types.ObjectId.isValid(id));
    if (validIds.length !== leadIds.length) {
      return res.status(400).json({
        success: false,
        message: 'Деякі ідентифікатори лідів мають невірний формат'
      });
    }

    // Check if leads exist
    const existingLeads = await Lead.find({ _id: { $in: validIds } });
    if (existingLeads.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Ліди не знайдені'
      });
    }

    // Update leads
    const result = await Lead.updateMany(
      { _id: { $in: validIds } },
      { $set: updateData }
    );
    
    console.log('Backend - Update result:', {
      modifiedCount: result.modifiedCount,
      requestedCount: leadIds.length,
      updateData
    });
    
    res.json({
      success: true,
      message: `Успішно оновлено ${result.modifiedCount} лідів`,
      modifiedCount: result.modifiedCount,
      requestedCount: leadIds.length
    });

  } catch (error) {
    console.error('Bulk update leads error:', error);
    res.status(500).json({
      success: false,
      message: 'Помилка при оновленні лідів',
      error: error.message
    });
  }
});

// Update lead
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const lead = await Lead.findById(req.params.id);
    
    if (!lead) {
      return res.status(404).json({
        success: false,
        message: 'Лид не найден'
      });
    }
    
    // Store old values for history logging
    const oldValues = {
      status: lead.status,
      assigned: lead.assigned,
      name: lead.name,
      phone: lead.phone,
      email: lead.email
    };
    
    // Update fields
    const changes = {};
    Object.keys(req.body).forEach(key => {
      if (req.body[key] !== undefined && lead[key] !== req.body[key]) {
        changes[key] = req.body[key];
        lead[key] = req.body[key];
      }
    });
    
    lead.updatedAt = new Date();
    await lead.save();
    
    // Log history for significant changes
    if (Object.keys(changes).length > 0) {
      const adminId = req.body.adminId || req.headers['x-admin-id'] || null;
      
      if (adminId) {
        // Log status change
        if (changes.status && changes.status !== oldValues.status) {
          await logStatusChanged(lead._id, adminId, oldValues.status, changes.status, lead.name);
        }
        
        // Log assignment change
        if (changes.assigned && changes.assigned !== oldValues.assigned) {
          await logAssignmentChanged(lead._id, adminId, oldValues.assigned, changes.assigned, lead.name);
        }
        
        // Log contact info changes
        const contactChanges = {};
        if (changes.name) contactChanges.name = changes.name;
        if (changes.phone) contactChanges.phone = changes.phone;
        if (changes.email) contactChanges.email = changes.email;
        
        if (Object.keys(contactChanges).length > 0) {
          await logContactInfoUpdated(lead._id, adminId, contactChanges, lead.name);
        }
        
        // Log general update if other fields changed
        const otherChanges = { ...changes };
        delete otherChanges.status;
        delete otherChanges.assigned;
        delete otherChanges.name;
        delete otherChanges.phone;
        delete otherChanges.email;
        
        if (Object.keys(otherChanges).length > 0) {
          await logLeadUpdated(lead._id, adminId, otherChanges, lead.name);
        }
      }
    }
    
    res.json({
      success: true,
      message: 'Лид успешно обновлен',
      data: lead
    });

  } catch (error) {
    console.error('Update lead error:', error);
    
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: messages.join(', ')
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Ошибка при обновлении лида'
    });
  }
});

// Update lead status
router.patch('/:id/status', authenticateToken, async (req, res) => {
  try {
    const { status } = req.body;
    
    if (!status) {
      return res.status(400).json({
        success: false,
        message: 'Статус обязателен'
      });
    }
    
    const lead = await Lead.findById(req.params.id);
    
    if (!lead) {
      return res.status(404).json({
        success: false,
        message: 'Лид не найден'
      });
    }
    
    await lead.updateStatus(status);
    
    res.json({
      success: true,
      message: 'Статус лида обновлен',
      data: lead
    });

  } catch (error) {
    console.error('Update status error:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка при обновлении статуса'
    });
  }
});

// Assign lead to user
router.patch('/:id/assign', authenticateToken, async (req, res) => {
  try {
    const { assigned } = req.body;
    
    const lead = await Lead.findById(req.params.id);
    
    if (!lead) {
      return res.status(404).json({
        success: false,
        message: 'Лид не найден'
      });
    }
    
    await lead.assignTo(assigned);
    
    res.json({
      success: true,
      message: 'Лид назначен',
      data: lead
    });

  } catch (error) {
    console.error('Assign lead error:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка при назначении лида'
    });
  }
});

// Add note to lead
router.post('/:id/notes', authenticateToken, async (req, res) => {
  try {
    const { text, note, photo, adminId } = req.body;
    const noteText = text || note; // Support both 'text' and 'note' parameters
    // Require either note text or photo
    if (!noteText && !photo) {
      return res.status(400).json({
        success: false,
        message: 'Потрібен текст коментаря або фото'
      });
    }
    
    const lead = await Lead.findById(req.params.id);
    
    if (!lead) {
      return res.status(404).json({
        success: false,
        message: 'Лид не найден'
      });
    }
    
    await lead.addNote(noteText, adminId, photo);
   
    
    res.json({
      success: true,
      message: 'Заметка добавлена',
      data: lead
    });

  } catch (error) {
    console.error('Add note error:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка при добавлении заметки'
    });
  }
});

// Hide/unhide lead
router.patch('/:id/visibility', authenticateToken, async (req, res) => {
  try {
    const { hidden } = req.body;
    
    const lead = await Lead.findById(req.params.id);
    
    if (!lead) {
      return res.status(404).json({
        success: false,
        message: 'Лид не найден'
      });
    }
    
    lead.hidden = hidden;
    lead.updatedAt = new Date();
    await lead.save();
    
    res.json({
      success: true,
      message: hidden ? 'Лид скрыт' : 'Лид показан',
      data: lead
    });

  } catch (error) {
    console.error('Toggle visibility error:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка при изменении видимости'
    });
  }
});

// Delete lead
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const lead = await Lead.findById(req.params.id);
    
    if (!lead) {
      return res.status(404).json({
        success: false,
        message: 'Лид не найден'
      });
    }
    
    await Lead.findByIdAndDelete(req.params.id);
    
    res.json({
      success: true,
      message: 'Лид успешно удален'
    });

  } catch (error) {
    console.error('Delete lead error:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка при удалении лида'
    });
  }
});

// Get leads statistics
router.get('/stats/overview', authenticateToken, async (req, res) => {
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

// Get leads count by status for filter buttons
router.get('/stats/status-counts', authenticateToken, async (req, res) => {
  try {
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

    // Build filter object (same logic as main leads endpoint)
    const filter = {};
    
    // Only add hidden filter if explicitly provided
    if (hidden !== undefined) {
      filter.hidden = hidden === 'true';
    }

    // Role-based filtering (only apply if no explicit assigned filter is provided)
    if (userRole && userId && !assigned) {
      if (userRole === 'Manager' || userRole === 'Reten') {
        // Manager/Reten can only see leads assigned to them
        filter.assigned = userId;
      } else if (userRole === 'TeamLead') {
        // TeamLead can see leads assigned to their team members
        const Admin = require('../models/Admin');
        const teamMembers = await Admin.find({ team: userTeam }, '_id');
        const teamMemberIds = teamMembers.map(admin => admin._id.toString());
        // Include TeamLead's own leads and their team members' leads
        teamMemberIds.push(userId);
        filter.assigned = { $in: teamMemberIds };
      }
      // Admin role has no additional filtering - can see all leads
    }
    
    // Additional assigned filter (only if no role-based filtering applied)
    if (assigned && !filter.assigned) {
      let ids = [];
      if (Array.isArray(assigned)) {
        ids = assigned;
      } else if (typeof assigned === 'string' && assigned.includes(',')) {
        ids = assigned.split(',');
      } else {
        ids = [assigned];
      }
      // Lead.assigned is stored as String, match by string values
      filter.assigned = { $in: ids };
    }
    
    if (search) {
      filter.$or = createPhoneSearchConditions(search);
    }

    if (department) {
      // Department is stored as INTEGER in database (confirmed by MongoDB shell)
      filter.department = parseInt(department, 10); // integer comparison
    }

    if (sourceDescription) {
      filter.sourceDescription = { $regex: sourceDescription, $options: 'i' };
    }

    if (utm_source) {
      // Replace + with spaces for UTM source matching (URL encoding issue)
      const normalizedUtmSource = utm_source.replace(/\+/g, ' ');
      filter.utm_source = { $regex: escapeRegex(normalizedUtmSource), $options: 'i' };
    }

    // Date filters
    if (dateFrom || dateTo) {
      filter.dateCreate = {};
      if (dateFrom) {
        filter.dateCreate.$gte = new Date(dateFrom);
      }
      if (dateTo) {
        // Include the entire day by setting time to end of day
        const endDate = new Date(dateTo);
        endDate.setHours(23, 59, 59, 999);
        filter.dateCreate.$lte = endDate;
      }
    }

    // Optional list of statuses to explicitly return; others will be grouped as 'OTHER'
    const statusesParam = req.query.statuses;
    const visibleStatuses = typeof statusesParam === 'string' && statusesParam.trim().length > 0
      ? statusesParam.split(',').map(s => s.trim()).filter(Boolean)
      : null;

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
    res.status(500).json({
      success: false,
      message: 'Ошибка при получении количества лидов',
      error: error.message
    });
  }
});



// Add note to lead
router.post('/:id/notes', authenticateToken, async (req, res) => {
  
  try {
    const { note, photo, adminId } = req.body;
    console.log("reqBODY",req.body);
    // Validate that either note or photo is provided
    if (!note && !photo) {
      return res.status(400).json({
        success: false,
        message: 'Необходимо предоставить текст заметки или фото'
      });
    }

    const lead = await Lead.findById(req.params.id);
    
    if (!lead) {
      return res.status(404).json({
        success: false,
        message: 'Лид не найден'
      });
    }

    // Add note with photo support directly in route
    
    // Create new note object
    const newNote = {
      text: note || '',
      photo: photo,
      createdAt: new Date(),
      adminId: adminId
    };
    
    
    // Add note to lead's notes array
    lead.notes.push(newNote);
    lead.updatedByNote = note || 'Додано фото';
    lead.updatedAt = new Date();
    
    // Save the lead
    await lead.save();
    
    // Log comment addition to history
   
    if (adminId) {
      await logCommentAdded(lead._id, adminId, note || '', lead.name, photo);
    } else {
      // Get first admin as fallback (in real app, get from auth token)
      const User = require('../models/User');
      const firstAdmin = await User.findOne({ role: 'admin' });
      const fallbackAdminId = firstAdmin ? firstAdmin._id : null;
      
      if (fallbackAdminId) {
        await logCommentAdded(lead._id, fallbackAdminId, note || '', lead.name, photo);
      }
    }
    
    // Return updated lead
    const updatedLead = await Lead.findById(req.params.id);
    
    res.json({
      success: true,
      data: updatedLead,
      message: 'Заметка успешно добавлена'
    });

  } catch (error) {
    console.error('Add note error:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка при добавлении заметки',
      error: error.message
    });
  }
});

// Edit note by index
router.put('/:id/notes/:noteIndex', authenticateToken, async (req, res) => {
  try {
    const { text, note, photo, adminId } = req.body;
    const noteText = text || note; // Support both 'text' and 'note' parameters
    const noteIndex = parseInt(req.params.noteIndex);
    
    const lead = await Lead.findById(req.params.id);
    
    if (!lead) {
      return res.status(404).json({
        success: false,
        message: 'Лид не найден'
      });
    }

    if (!lead.notes || noteIndex >= lead.notes.length || noteIndex < 0) {
      return res.status(404).json({
        success: false,
        message: 'Коментар не знайдено'
      });
    }

    // Update the note
    lead.notes[noteIndex].text = noteText || '';
    if (photo !== undefined) {
      lead.notes[noteIndex].photo = photo;
    }
    // if (author !== undefined) {
    //   lead.notes[noteIndex].author = author;
    // }
    lead.notes[noteIndex].updatedAt = new Date();
    
    lead.updatedAt = new Date();
    await lead.save();
    
    // Create history entry
    const LeadsHistory = require('../models/LeadsHistory');
    const User = require('../models/User');
    const firstAdmin = await User.findOne({ role: 'admin' });
    
    if (adminId) {
      await LeadsHistory.createHistoryEntry({
        leadId: req.params.id,
        actionType: 'COMMENT_EDITED',
        description: `Відредаговано коментар: ${note}`,
        adminId: adminId,
        metadata: {
          noteIndex: noteIndex,
          noteText: note,
          hasPhoto: !!photo
        }
      });
    }
    
    res.json({
      success: true,
      data: lead,
      message: 'Коментар успішно відредаговано'
    });

  } catch (error) {
    console.error('Edit note error:', error);
    res.status(500).json({
      success: false,
      message: 'Помилка при редагуванні коментаря',
      error: error.message
    });
  }
});

// Delete note by index
router.delete('/:id/notes/:noteIndex', authenticateToken, async (req, res) => {
  try {
    const noteIndex = parseInt(req.params.noteIndex);
    
    const lead = await Lead.findById(req.params.id);
    
    if (!lead) {
      return res.status(404).json({
        success: false,
        message: 'Лид не найден'
      });
    }

    if (!lead.notes || noteIndex >= lead.notes.length || noteIndex < 0) {
      return res.status(404).json({
        success: false,
        message: 'Коментар не знайдено'
      });
    }

    // Store note info for history before deletion
    const deletedNote = lead.notes[noteIndex];
    
    // Remove the note
    lead.notes.splice(noteIndex, 1);
    lead.updatedAt = new Date();
    await lead.save();
    
    // Create history entry
    const LeadsHistory = require('../models/LeadsHistory');
    const User = require('../models/User');
    const firstAdmin = await User.findOne({ role: 'admin' });
    const adminId = firstAdmin ? firstAdmin._id : null;
    
    if (adminId) {
      await LeadsHistory.createHistoryEntry({
        leadId: req.params.id,
        actionType: 'COMMENT_DELETED',
        description: `Видалено коментар: ${deletedNote.text || 'Фото'}`,
        adminId: adminId,
        metadata: {
          noteIndex: noteIndex,
          deletedNoteText: deletedNote.text,
          hadPhoto: !!deletedNote.photo
        }
      });
    }
    
    res.json({
      success: true,
      data: lead,
      message: 'Коментар успішно видалено'
    });

  } catch (error) {
    console.error('Delete note error:', error);
    res.status(500).json({
      success: false,
      message: 'Помилка при видаленні коментаря',
      error: error.message
    });
  }
});

// Migration endpoint to normalize existing phone numbers
router.post('/migrate/normalize-phones', authenticateToken, async (req, res) => {
  try {
    // Find all leads that need phone normalization
    const leads = await Lead.find({});
    let updatedCount = 0;
    
    for (const lead of leads) {
      const normalizedPhone = lead.phone.replace(/\D/g, '');
      
      // Only update if normalizedPhone is different
      if (lead.normalizedPhone !== normalizedPhone) {
        await Lead.updateOne(
          { _id: lead._id },
          { normalizedPhone: normalizedPhone }
        );
        updatedCount++;
      }
    }
    
    res.json({
      success: true,
      message: `Нормалізовано ${updatedCount} номерів телефонів`,
      data: {
        totalLeads: leads.length,
        updatedCount: updatedCount
      }
    });

  } catch (error) {
    console.error('Phone normalization migration error:', error);
    res.status(500).json({
      success: false,
      message: 'Помилка при нормалізації номерів телефонів',
      error: error.message
    });
  }
});


module.exports = router;
