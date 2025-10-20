const express = require('express');
const router = express.Router();

// Health check endpoint to verify environment configuration
router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    jwtSecretSet: !!process.env.JWT_SECRET,
    jwtSecretLength: process.env.JWT_SECRET?.length || 0,
    mongoConnected: require('mongoose').connection.readyState === 1
  });
});

// Detailed diagnostic endpoint (only for debugging)
router.get('/health/detailed', (req, res) => {
  const mongoose = require('mongoose');
  
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: {
      NODE_ENV: process.env.NODE_ENV || 'not set',
      PORT: process.env.PORT || 'not set',
      JWT_SECRET_SET: !!process.env.JWT_SECRET,
      JWT_SECRET_LENGTH: process.env.JWT_SECRET?.length || 0,
      JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || 'not set',
      MONGODB_URI_SET: !!process.env.MONGODB_URI
    },
    database: {
      connected: mongoose.connection.readyState === 1,
      readyState: mongoose.connection.readyState,
      // 0 = disconnected, 1 = connected, 2 = connecting, 3 = disconnecting
      name: mongoose.connection.name || 'not connected'
    },
    memory: {
      used: `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`,
      total: `${Math.round(process.memoryUsage().heapTotal / 1024 / 1024)}MB`
    },
    uptime: `${Math.round(process.uptime())}s`
  });
});

module.exports = router;
