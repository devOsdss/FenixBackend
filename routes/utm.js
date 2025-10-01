const express = require('express');
const router = express.Router();
const UTMSource = require('../models/UTM');
const { authenticateToken } = require('../middleware/auth');

// GET /api/utm/options - Отримати всі UTM джерела з опціями для dropdown
router.get('/options', authenticateToken, async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 50, 
      sortBy = 'priority', 
      sortOrder = 'desc',
      category,
      isActive,
      search 
    } = req.query;

    // Побудова фільтра
    const filter = {};
    
    if (category) {
      filter.category = category;
    }
    
    if (isActive !== undefined) {
      filter.isActive = isActive === 'true';
    }
    
    if (search) {
      filter.$or = [
        { label: { $regex: search, $options: 'i' } },
        { value: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    // Побудова сортування
    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    // Пагінація
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Отримання даних
    const utmSources = await UTMSource.find(filter)
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit));

    const totalCount = await UTMSource.countDocuments(filter);

    res.json({
      success: true,
      data: utmSources,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: totalCount,
        pages: Math.ceil(totalCount / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Помилка отримання UTM джерел:', error);
    res.status(500).json({
      success: false,
      message: 'Помилка сервера при отриманні UTM джерел',
      error: error.message
    });
  }
});

// GET /api/utm/options/active - Отримати тільки активні UTM джерела для dropdown
router.get('/options/active', authenticateToken, async (req, res) => {
  try {
    const utmSources = await UTMSource.findActive();
    
    res.json({
      success: true,
      data: utmSources.map(utm => ({
        value: utm.value,
        label: utm.label,
        category: utm.category
      }))
    });
  } catch (error) {
    console.error('Помилка отримання активних UTM джерел:', error);
    res.status(500).json({
      success: false,
      message: 'Помилка сервера при отриманні активних UTM джерел',
      error: error.message
    });
  }
});

// GET /api/utm/options/categories - Отримати доступні категорії
router.get('/options/categories', authenticateToken, async (req, res) => {
  try {
    const categories = [
      { value: 'social', label: 'Соціальні мережі' },
      { value: 'email', label: 'Email маркетинг' },
      { value: 'advertising', label: 'Реклама' },
      { value: 'referral', label: 'Реферали' },
      { value: 'direct', label: 'Прямий трафік' },
      { value: 'organic', label: 'Органічний пошук' },
      { value: 'other', label: 'Інше' }
    ];

    res.json({
      success: true,
      data: categories
    });
  } catch (error) {
    console.error('Помилка отримання категорій UTM:', error);
    res.status(500).json({
      success: false,
      message: 'Помилка сервера при отриманні категорій UTM',
      error: error.message
    });
  }
});

// GET /api/utm/options/:id - Отримати UTM джерело за ID
router.get('/options/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        success: false,
        message: 'Невірний формат ID UTM джерела'
      });
    }

    const utmSource = await UTMSource.findById(id);

    if (!utmSource) {
      return res.status(404).json({
        success: false,
        message: 'UTM джерело не знайдено'
      });
    }

    res.json({
      success: true,
      data: utmSource
    });
  } catch (error) {
    console.error('Помилка отримання UTM джерела:', error);
    res.status(500).json({
      success: false,
      message: 'Помилка сервера при отриманні UTM джерела',
      error: error.message
    });
  }
});

// POST /api/utm/options - Створити нове UTM джерело
router.post('/options', authenticateToken, async (req, res) => {
  try {
    const { label, value, description, category = 'other', isActive = true, priority = 0 } = req.body;

    // Валідація обов'язкових полів
    if (!label || !value) {
      return res.status(400).json({
        success: false,
        message: 'Назва та значення UTM джерела є обов\'язковими'
      });
    }

    // Перевірка унікальності value
    const existingUTM = await UTMSource.findOne({ value: value.trim() });
    if (existingUTM) {
      return res.status(400).json({
        success: false,
        message: 'UTM джерело з таким значенням вже існує'
      });
    }

    const utmSource = new UTMSource({
      label: label.trim(),
      value: value.trim(),
      description: description?.trim(),
      category,
      isActive,
      priority: parseInt(priority) || 0
    });

    await utmSource.save();

    res.status(201).json({
      success: true,
      message: 'UTM джерело успішно створено',
      data: utmSource
    });
  } catch (error) {
    console.error('Помилка створення UTM джерела:', error);
    
    if (error.code === 'DUPLICATE_VALUE') {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    res.status(500).json({
      success: false,
      message: 'Помилка сервера при створенні UTM джерела',
      error: error.message
    });
  }
});

// PUT /api/utm/options/:id - Оновити UTM джерело
router.put('/options/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { label, value, description, category, isActive, priority } = req.body;

    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        success: false,
        message: 'Невірний формат ID UTM джерела'
      });
    }

    // Валідація обов'язкових полів
    if (!label || !value) {
      return res.status(400).json({
        success: false,
        message: 'Назва та значення UTM джерела є обов\'язковими'
      });
    }

    const utmSource = await UTMSource.findById(id);
    if (!utmSource) {
      return res.status(404).json({
        success: false,
        message: 'UTM джерело не знайдено'
      });
    }

    // Оновлення полів
    utmSource.label = label.trim();
    utmSource.value = value.trim();
    utmSource.description = description?.trim();
    utmSource.category = category || utmSource.category;
    utmSource.isActive = isActive !== undefined ? isActive : utmSource.isActive;
    utmSource.priority = priority !== undefined ? parseInt(priority) : utmSource.priority;

    await utmSource.save();

    res.json({
      success: true,
      message: 'UTM джерело успішно оновлено',
      data: utmSource
    });
  } catch (error) {
    console.error('Помилка оновлення UTM джерела:', error);
    
    if (error.code === 'DUPLICATE_VALUE') {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    res.status(500).json({
      success: false,
      message: 'Помилка сервера при оновленні UTM джерела',
      error: error.message
    });
  }
});

// DELETE /api/utm/options/:id - Видалити UTM джерело
router.delete('/options/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        success: false,
        message: 'Невірний формат ID UTM джерела'
      });
    }

    const utmSource = await UTMSource.findById(id);
    if (!utmSource) {
      return res.status(404).json({
        success: false,
        message: 'UTM джерело не знайдено'
      });
    }

    await UTMSource.findByIdAndDelete(id);

    res.json({
      success: true,
      message: 'UTM джерело успішно видалено'
    });
  } catch (error) {
    console.error('Помилка видалення UTM джерела:', error);
    res.status(500).json({
      success: false,
      message: 'Помилка сервера при видаленні UTM джерела',
      error: error.message
    });
  }
});

// PATCH /api/utm/options/:id/toggle - Перемкнути статус активності UTM джерела
router.patch('/options/:id/toggle', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        success: false,
        message: 'Невірний формат ID UTM джерела'
      });
    }

    const utmSource = await UTMSource.findById(id);
    if (!utmSource) {
      return res.status(404).json({
        success: false,
        message: 'UTM джерело не знайдено'
      });
    }

    await utmSource.toggle();

    res.json({
      success: true,
      message: `UTM джерело ${utmSource.isActive ? 'активовано' : 'деактивовано'}`,
      data: utmSource
    });
  } catch (error) {
    console.error('Помилка перемикання статусу UTM джерела:', error);
    res.status(500).json({
      success: false,
      message: 'Помилка сервера при перемиканні статусу UTM джерела',
      error: error.message
    });
  }
});

// PATCH /api/utm/options/bulk/toggle - Масове перемикання статусу UTM джерел
router.patch('/options/bulk/toggle', authenticateToken, async (req, res) => {
  try {
    const { ids, isActive } = req.body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Необхідно передати масив ID UTM джерел'
      });
    }

    if (isActive === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Необхідно вказати статус активності'
      });
    }

    // Валідація ID
    const invalidIds = ids.filter(id => !id.match(/^[0-9a-fA-F]{24}$/));
    if (invalidIds.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Невірний формат деяких ID UTM джерел'
      });
    }

    const result = await UTMSource.updateMany(
      { _id: { $in: ids } },
      { isActive }
    );

    res.json({
      success: true,
      message: `${result.modifiedCount} UTM джерел ${isActive ? 'активовано' : 'деактивовано'}`,
      modifiedCount: result.modifiedCount
    });
  } catch (error) {
    console.error('Помилка масового перемикання статусу UTM джерел:', error);
    res.status(500).json({
      success: false,
      message: 'Помилка сервера при масовому перемиканні статусу UTM джерел',
      error: error.message
    });
  }
});

// DELETE /api/utm/options/bulk/delete - Масове видалення UTM джерел
router.delete('/options/bulk/delete', authenticateToken, async (req, res) => {
  try {
    const { ids } = req.body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Необхідно передати масив ID UTM джерел для видалення'
      });
    }

    // Валідація ID
    const invalidIds = ids.filter(id => !id.match(/^[0-9a-fA-F]{24}$/));
    if (invalidIds.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Невірний формат деяких ID UTM джерел'
      });
    }

    const result = await UTMSource.deleteMany({ _id: { $in: ids } });

    res.json({
      success: true,
      message: `${result.deletedCount} UTM джерел успішно видалено`,
      deletedCount: result.deletedCount
    });
  } catch (error) {
    console.error('Помилка масового видалення UTM джерел:', error);
    res.status(500).json({
      success: false,
      message: 'Помилка сервера при масовому видаленні UTM джерел',
      error: error.message
    });
  }
});

module.exports = router;
