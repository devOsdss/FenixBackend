const express = require('express');
const router = express.Router();
const Source = require('../models/Source');
const { authenticateToken } = require('../middleware/auth');

// GET /api/sources - Get all sources
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { active, sortBy = 'priority', sortOrder = 'asc' } = req.query;
    
    console.log('Sources API called with params:', { active, sortBy, sortOrder });
    
    // Build filter
    const filter = {};
    if (active !== undefined) {
      filter.isActive = active === 'true';
    }

    console.log('Sources filter:', filter);

    // Build sort - validate sortBy to prevent errors
    const validSortFields = ['name', 'priority', 'type', 'createdAt', 'updatedAt'];
    const safeSortBy = validSortFields.includes(sortBy) ? sortBy : 'priority';
    const sort = {};
    sort[safeSortBy] = sortOrder === 'desc' ? -1 : 1;

    console.log('Sources sort:', sort);

    const sources = await Source.find(filter).sort(sort);
    console.log('Found sources:', sources.length);
    
    res.json({
      success: true,
      data: sources,
      count: sources.length
    });
  } catch (error) {
    console.error('Error fetching sources:', error);
    console.error('Error stack:', error.stack);
    console.error('Error name:', error.name);
    res.status(500).json({
      success: false,
      message: 'Помилка при отриманні джерел',
      error: error.message,
      errorName: error.name,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// GET /api/sources/options - Get source options for frontend dropdowns
router.get('/options', authenticateToken, async (req, res) => {
  try {
    const options = await Source.getSourceOptions();
    
    res.json({
      success: true,
      data: options
    });
  } catch (error) {
    console.error('Error fetching source options:', error);
    res.status(500).json({
      success: false,
      message: 'Помилка при отриманні опцій джерел',
      error: error.message
    });
  }
});

// GET /api/sources/counts - Get leads count by source
router.get('/counts', authenticateToken, async (req, res) => {
  try {
    // This would need to be implemented based on your leads model
    // For now, returning empty counts
    const counts = {};
    
    res.json({
      success: true,
      data: counts
    });
  } catch (error) {
    console.error('Error fetching source counts:', error);
    res.status(500).json({
      success: false,
      message: 'Помилка при отриманні статистики джерел',
      error: error.message
    });
  }
});

// GET /api/sources/:id - Get source by ID
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const source = await Source.findById(req.params.id);
    
    if (!source) {
      return res.status(404).json({
        success: false,
        message: 'Джерело не знайдено'
      });
    }
    
    res.json({
      success: true,
      data: source
    });
  } catch (error) {
    console.error('Error fetching source:', error);
    res.status(500).json({
      success: false,
      message: 'Помилка при отриманні джерела',
      error: error.message
    });
  }
});

// POST /api/sources - Create new source
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { name, description, type, url, isActive, priority } = req.body;

    // Validation
    if (!name || !type) {
      return res.status(400).json({
        success: false,
        message: 'Назва та тип джерела є обов\'язковими'
      });
    }

    // Check if source with same name already exists
    const existingSource = await Source.findOne({ name: name.trim() });
    if (existingSource) {
      return res.status(400).json({
        success: false,
        message: 'Джерело з такою назвою вже існує'
      });
    }

    const source = new Source({
      name: name.trim(),
      description: description?.trim(),
      type,
      url: url?.trim(),
      isActive: isActive !== undefined ? isActive : true,
      priority: priority || 0
    });

    await source.save();
    
    res.status(201).json({
      success: true,
      data: source,
      message: 'Джерело успішно створено'
    });
  } catch (error) {
    console.error('Error creating source:', error);
    res.status(500).json({
      success: false,
      message: 'Помилка при створенні джерела',
      error: error.message
    });
  }
});

// PUT /api/sources/:id - Update source
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { name, description, type, url, isActive, priority } = req.body;

    // Find source
    const source = await Source.findById(req.params.id);
    if (!source) {
      return res.status(404).json({
        success: false,
        message: 'Джерело не знайдено'
      });
    }

    // Check if name is being changed and if new name already exists
    if (name && name.trim() !== source.name) {
      const existingSource = await Source.findOne({ 
        name: name.trim(),
        _id: { $ne: req.params.id }
      });
      if (existingSource) {
        return res.status(400).json({
          success: false,
          message: 'Джерело з такою назвою вже існує'
        });
      }
    }

    // Update fields
    if (name !== undefined) source.name = name.trim();
    if (description !== undefined) source.description = description?.trim();
    if (type !== undefined) source.type = type;
    if (url !== undefined) source.url = url?.trim();
    if (isActive !== undefined) source.isActive = isActive;
    if (priority !== undefined) source.priority = priority;

    await source.save();
    
    res.json({
      success: true,
      data: source,
      message: 'Джерело успішно оновлено'
    });
  } catch (error) {
    console.error('Error updating source:', error);
    res.status(500).json({
      success: false,
      message: 'Помилка при оновленні джерела',
      error: error.message
    });
  }
});

// DELETE /api/sources/:id - Delete source
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const source = await Source.findById(req.params.id);
    
    if (!source) {
      return res.status(404).json({
        success: false,
        message: 'Джерело не знайдено'
      });
    }

    await Source.findByIdAndDelete(req.params.id);
    
    res.json({
      success: true,
      message: 'Джерело успішно видалено'
    });
  } catch (error) {
    console.error('Error deleting source:', error);
    res.status(500).json({
      success: false,
      message: 'Помилка при видаленні джерела',
      error: error.message
    });
  }
});

// PATCH /api/sources/:id/toggle - Toggle source active state
router.patch('/:id/toggle', authenticateToken, async (req, res) => {
  try {
    const source = await Source.findById(req.params.id);
    
    if (!source) {
      return res.status(404).json({
        success: false,
        message: 'Джерело не знайдено'
      });
    }

    source.isActive = !source.isActive;
    await source.save();
    
    res.json({
      success: true,
      data: source,
      message: `Джерело ${source.isActive ? 'активовано' : 'деактивовано'}`
    });
  } catch (error) {
    console.error('Error toggling source:', error);
    res.status(500).json({
      success: false,
      message: 'Помилка при зміні статусу джерела',
      error: error.message
    });
  }
});

// PATCH /api/sources/bulk/toggle - Bulk toggle sources
router.patch('/bulk/toggle', authenticateToken, async (req, res) => {
  try {
    const { ids } = req.body;
    
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Необхідно вказати список ID джерел'
      });
    }

    const sources = await Source.find({ _id: { $in: ids } });
    
    if (sources.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Джерела не знайдено'
      });
    }

    // Toggle each source
    const updatedSources = [];
    for (const source of sources) {
      source.isActive = !source.isActive;
      await source.save();
      updatedSources.push(source);
    }
    
    res.json({
      success: true,
      data: updatedSources,
      message: `Успішно змінено статус ${updatedSources.length} джерел`
    });
  } catch (error) {
    console.error('Error bulk toggling sources:', error);
    res.status(500).json({
      success: false,
      message: 'Помилка при масовій зміні статусу джерел',
      error: error.message
    });
  }
});

// DELETE /api/sources/bulk/delete - Bulk delete sources
router.delete('/bulk/delete', authenticateToken, async (req, res) => {
  try {
    const { ids } = req.body;
    
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Необхідно вказати список ID джерел'
      });
    }

    const result = await Source.deleteMany({ _id: { $in: ids } });
    
    res.json({
      success: true,
      message: `Успішно видалено ${result.deletedCount} джерел`
    });
  } catch (error) {
    console.error('Error bulk deleting sources:', error);
    res.status(500).json({
      success: false,
      message: 'Помилка при масовому видаленні джерел',
      error: error.message
    });
  }
});

module.exports = router;
