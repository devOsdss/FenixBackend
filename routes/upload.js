const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { authenticateToken } = require('../middleware/auth');
const router = express.Router();

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, '../public/uploads/comments');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure multer for file upload
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadsDir);
  },
  filename: function (req, file, cb) {
    const leadId = req.body.leadId || 'unknown';
    const timestamp = Date.now();
    const fileExtension = path.extname(file.originalname);
    const fileName = `${leadId}_${timestamp}${fileExtension}`;
    cb(null, fileName);
  }
});

// File filter to allow only images
const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Файл повинен бути зображенням'), false);
  }
};

const upload = multer({ 
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  }
});

// Upload photo endpoint
router.post('/photo', authenticateToken, upload.single('photo'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Фото не предоставлено'
      });
    }

    if (!req.body.leadId) {
      return res.status(400).json({
        success: false,
        message: 'ID ліда не предоставлено'
      });
    }

    // Return the public URL
    const photoUrl = `/uploads/comments/${req.file.filename}`;

    res.json({
      success: true,
      photoUrl,
      message: 'Фото успішно завантажено'
    });

  } catch (error) {
    console.error('Error uploading photo:', error);
    res.status(500).json({
      success: false,
      message: 'Помилка при завантаженні фото',
      error: error.message
    });
  }
});

// Handle multer errors
router.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        message: 'Розмір файлу не повинен перевищувати 5MB'
      });
    }
  }
  
  res.status(500).json({
    success: false,
    message: error.message || 'Помилка при завантаженні фото'
  });
});

module.exports = router;
