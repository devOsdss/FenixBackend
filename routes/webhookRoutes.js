const express = require('express');
const router = express.Router();
const { processTildaWebhook } = require('../controllers/webhookController');

// Tilda webhook endpoint
router.post('/tilda', processTildaWebhook);

module.exports = router;
