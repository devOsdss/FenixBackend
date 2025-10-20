const jwt = require('jsonwebtoken');

// Generate JWT token
const generateToken = (payload) => {
  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '24h'
  });
};

// Verify JWT token
const verifyToken = (token) => {
  try {
    return jwt.verify(token, process.env.JWT_SECRET);
  } catch (error) {
    // Log the actual error for debugging
    console.error('❌ JWT Verification Error:', {
      name: error.name,
      message: error.message,
      tokenPreview: token ? token.substring(0, 20) + '...' : 'no token',
      secretSet: !!process.env.JWT_SECRET,
      secretLength: process.env.JWT_SECRET?.length || 0
    });
    
    // Provide more specific error messages
    if (error.name === 'TokenExpiredError') {
      throw new Error('Token expired');
    } else if (error.name === 'JsonWebTokenError') {
      throw new Error('Invalid token signature');
    } else if (error.name === 'NotBeforeError') {
      throw new Error('Token not active');
    } else {
      throw new Error(`Token verification failed: ${error.message}`);
    }
  }
};

// Generate refresh token
const generateRefreshToken = (payload) => {
  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: '7d' // Refresh token expires in 7 days
  });
};

module.exports = {
  generateToken,
  verifyToken,
  generateRefreshToken
};
