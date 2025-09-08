const { verifyToken } = require('../utils/jwt');
const Admin = require('../models/Admin');

// Middleware to verify JWT token
const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Токен доступа отсутствует'
      });
    }

    // Verify token
    const decoded = verifyToken(token);
    
    // Find admin by ID from token
    const admin = await Admin.findById(decoded.id);
    
    if (!admin) {
      return res.status(401).json({
        success: false,
        message: 'Недействительный токен'
      });
    }

    // Add admin to request object
    req.admin = admin;
    next();

  } catch (error) {
    console.error('Auth middleware error:', error);
    return res.status(403).json({
      success: false,
      message: 'Недействительный или истекший токен'
    });
  }
};

// Middleware to check admin role
const requireRole = (roles) => {
  return (req, res, next) => {
    if (!req.admin) {
      return res.status(401).json({
        success: false,
        message: 'Аутентификация требуется'
      });
    }

    if (!roles.includes(req.admin.role)) {
      return res.status(403).json({
        success: false,
        message: 'Недостаточно прав доступа'
      });
    }

    next();
  };
};

// Middleware to check if admin is active (if you add this field later)
const requireActive = (req, res, next) => {
  if (!req.admin) {
    return res.status(401).json({
      success: false,
      message: 'Аутентификация требуется'
    });
  }

  // For now, all admins are considered active
  // You can add an 'isActive' field to Admin model if needed
  next();
};

module.exports = {
  authenticateToken,
  requireRole,
  requireActive
};
