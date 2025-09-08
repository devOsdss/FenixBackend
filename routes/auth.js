const express = require('express');
const Admin = require('../models/Admin');
const { generateToken, generateRefreshToken } = require('../utils/jwt');
const { authenticateToken } = require('../middleware/auth');
const router = express.Router();

// Login route
router.post('/login', async (req, res) => {
  try {
    const { email: login, password } = req.body;

    // Validate input
    if (!login || !password) {
      return res.status(400).json({
        success: false,
        message: 'Логин и пароль обязательны'
      });
    }

    // Find admin by login
    const admin = await Admin.findByLogin(login.trim());
    
    if (!admin) {
      return res.status(401).json({
        success: false,
        message: 'Неверный логин или пароль'
      });
    }

    // Compare password using bcrypt
    const isPasswordValid = await admin.comparePassword(password);
    
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Неверный логин или пароль'
      });
    }

    // Generate JWT tokens
    const tokenPayload = {
      id: admin._id,
      login: admin.login,
      role: admin.role,
      department: admin.department
    };
    
    const accessToken = generateToken(tokenPayload);
    const refreshToken = generateRefreshToken({ id: admin._id });
    
    // Save refresh token to database
    admin.refreshToken = refreshToken;
    await admin.save();

    // Return success response with JWT tokens
    res.json({
      success: true,
      message: 'Успешный вход в систему',
      admin: {
        id: admin._id,
        login: admin.login,
        role: admin.role,
        department: admin.department,
        bitrixId: admin.bitrixId
      },
      tokens: {
        accessToken,
        refreshToken
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Внутренняя ошибка сервера'
    });
  }
});

// Register route
router.post('/register', async (req, res) => {
  try {
    const { email: login, password } = req.body;

    // Validate input
    if (!login || !password) {
      return res.status(400).json({
        success: false,
        message: 'Логин и пароль обязательны'
      });
    }

    // Check if admin already exists
    const existingAdmin = await Admin.findByLogin(login.trim());
    
    if (existingAdmin) {
      return res.status(409).json({
        success: false,
        message: 'Администратор с таким логином уже существует'
      });
    }

    // Create new admin (password will be hashed automatically by pre-save middleware)
    const newAdmin = new Admin({
      login: login.trim(),
      password: password,
      role: 'User' // Default role
    });

    await newAdmin.save();

    res.status(201).json({
      success: true,
      message: 'Администратор успешно зарегистрирован',
      admin: newAdmin.getSafeData()
    });

  } catch (error) {
    console.error('Registration error:', error);
    
    // Handle validation errors
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: messages.join(', ')
      });
    }

    res.status(500).json({
      success: false,
      message: 'Внутренняя ошибка сервера'
    });
  }
});

// Get current admin info (requires JWT authentication)
router.get('/me', authenticateToken, async (req, res) => {
  try {
    res.json({
      success: true,
      admin: req.admin.getSafeData()
    });
  } catch (error) {
    console.error('Get current admin error:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка при получении данных администратора'
    });
  }
});

// Logout route (clears refresh token)
router.post('/logout', authenticateToken, async (req, res) => {
  try {
    // Clear refresh token
    req.admin.refreshToken = null;
    await req.admin.save();
    
    res.json({
      success: true,
      message: 'Успешный выход из системы'
    });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка при выходе из системы'
    });
  }
});

// Refresh token route
router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;
    
    if (!refreshToken) {
      return res.status(401).json({
        success: false,
        message: 'Refresh token отсутствует'
      });
    }
    
    // Find admin with this refresh token
    const admin = await Admin.findOne({ refreshToken });
    
    if (!admin) {
      return res.status(403).json({
        success: false,
        message: 'Недействительный refresh token'
      });
    }
    
    // Generate new access token
    const tokenPayload = {
      id: admin._id,
      login: admin.login,
      role: admin.role,
      department: admin.department
    };
    
    const newAccessToken = generateToken(tokenPayload);
    
    res.json({
      success: true,
      accessToken: newAccessToken
    });
    
  } catch (error) {
    console.error('Refresh token error:', error);
    res.status(403).json({
      success: false,
      message: 'Ошибка обновления токена'
    });
  }
});

module.exports = router;
