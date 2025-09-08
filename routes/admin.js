const express = require('express');
const Admin = require('../models/Admin');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');

// Get all admins with filtering
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { role, department, search, team } = req.query;

    // Build filter object
    const filter = {};
    
    if (role) {
      filter.role = role;
    }
    
    if (department) {
      filter.department = parseInt(department);
    }
    
    if (search) {
      filter.login = { $regex: search, $options: 'i' };
    }
    
    if (team) {
      filter.team = team;
    }

    // Get admins
    const admins = await Admin.find(filter).sort({ create_ad: -1 });
    
    res.json({
      success: true,
      data: admins
    });

  } catch (error) {
    console.error('Get admins error:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка при получении администраторов'
    });
  }
});

// Get single admin by ID
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const admin = await Admin.findById(req.params.id);
    
    if (!admin) {
      return res.status(404).json({
        success: false,
        message: 'Администратор не найден'
      });
    }
    
    res.json({
      success: true,
      data: admin
    });

  } catch (error) {
    console.error('Get admin error:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка при получении администратора'
    });
  }
});

// Create new admin
router.post('/', authenticateToken, async (req, res) => {
  try {
    const adminData = req.body;
    
    // Check if admin with this login already exists
    const existingAdmin = await Admin.findByLogin(adminData.login);
    if (existingAdmin) {
      return res.status(409).json({
        success: false,
        message: 'Администратор с таким логином уже существует'
      });
    }
    
    const newAdmin = new Admin(adminData);
    await newAdmin.save();
    
    res.status(201).json({
      success: true,
      message: 'Администратор успешно создан',
      data: newAdmin.getSafeData()
    });

  } catch (error) {
    console.error('Create admin error:', error);
    
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: messages.join(', ')
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Ошибка при создании администратора'
    });
  }
});

// Update admin
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const admin = await Admin.findById(req.params.id);
    
    if (!admin) {
      return res.status(404).json({
        success: false,
        message: 'Администратор не найден'
      });
    }
    
    // Update fields (except password - handle separately)
    const allowedFields = ['login', 'role', 'responsible', 'department', 'bitrixId'];
    allowedFields.forEach(field => {
      if (req.body[field] !== undefined) {
        admin[field] = req.body[field];
      }
    });
    
    await admin.save();
    
    res.json({
      success: true,
      message: 'Администратор успешно обновлен',
      data: admin.getSafeData()
    });

  } catch (error) {
    console.error('Update admin error:', error);
    
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: messages.join(', ')
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Ошибка при обновлении администратора'
    });
  }
});

// Update admin password
router.patch('/:id/password', authenticateToken, async (req, res) => {
  try {
    const { password } = req.body;
    
    if (!password) {
      return res.status(400).json({
        success: false,
        message: 'Пароль обязателен'
      });
    }
    
    const admin = await Admin.findById(req.params.id);
    
    if (!admin) {
      return res.status(404).json({
        success: false,
        message: 'Администратор не найден'
      });
    }
    
    // TODO: Hash password with bcrypt before saving
    admin.password = password;
    await admin.save();
    
    res.json({
      success: true,
      message: 'Пароль успешно обновлен'
    });

  } catch (error) {
    console.error('Update password error:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка при обновлении пароля'
    });
  }
});

// Assign admin to department
router.patch('/:id/department', authenticateToken, async (req, res) => {
  try {
    const { department } = req.body;
    
    const admin = await Admin.findById(req.params.id);
    
    if (!admin) {
      return res.status(404).json({
        success: false,
        message: 'Администратор не найден'
      });
    }
    
    await admin.assignToDepartment(department);
    
    res.json({
      success: true,
      message: 'Администратор назначен в отдел',
      data: admin.getSafeData()
    });

  } catch (error) {
    console.error('Assign department error:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка при назначении в отдел'
    });
  }
});

// Set responsible for admin
router.patch('/:id/responsible', authenticateToken, async (req, res) => {
  try {
    const { responsible } = req.body;
    
    const admin = await Admin.findById(req.params.id);
    
    if (!admin) {
      return res.status(404).json({
        success: false,
        message: 'Администратор не найден'
      });
    }
    
    await admin.setResponsible(responsible);
    
    res.json({
      success: true,
      message: 'Ответственный назначен',
      data: admin.getSafeData()
    });

  } catch (error) {
    console.error('Set responsible error:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка при назначении ответственного'
    });
  }
});

// Delete admin
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const admin = await Admin.findById(req.params.id);
    
    if (!admin) {
      return res.status(404).json({
        success: false,
        message: 'Администратор не найден'
      });
    }
    
    await Admin.findByIdAndDelete(req.params.id);
    
    res.json({
      success: true,
      message: 'Администратор успешно удален'
    });

  } catch (error) {
    console.error('Delete admin error:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка при удалении администратора'
    });
  }
});

// Get admins by role
router.get('/role/:role', authenticateToken, async (req, res) => {
  try {
    const admins = await Admin.findByRole(req.params.role);
    
    res.json({
      success: true,
      data: admins
    });

  } catch (error) {
    console.error('Get admins by role error:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка при получении администраторов по роли'
    });
  }
});

// Get admins by department
router.get('/department/:department', authenticateToken, async (req, res) => {
  try {
    const department = parseInt(req.params.department);
    const admins = await Admin.findByDepartment(department);
    
    res.json({
      success: true,
      data: admins
    });

  } catch (error) {
    console.error('Get admins by department error:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка при получении администраторов по отделу'
    });
  }
});

module.exports = router;
