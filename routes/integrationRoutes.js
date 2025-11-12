const express = require('express');
const router = express.Router();
const { handleIntegrationWebhook } = require('../controllers/integrationController');

// Middleware для валідації API ключа
const validateApiKey = (req, res, next) => {
    // API ключ може бути переданий у заголовку X-API-Key або Authorization: Bearer <key>
    const apiKeyHeader = req.headers['x-api-key'];
    const authHeader = req.headers['authorization'];
    
    let apiKey = apiKeyHeader;
    
    // Якщо використовується Bearer токен
    if (!apiKey && authHeader) {
        const parts = authHeader.split(' ');
        if (parts.length === 2 && parts[0] === 'Bearer') {
            apiKey = parts[1];
        }
    }
    
    console.log('\n=== API Key Validation ===');
    console.log('Received API Key:', apiKey ? '***' + apiKey.slice(-4) : 'MISSING');
    console.log('Expected API Key:', process.env.INTEGRATION_API_KEY ? '***' + process.env.INTEGRATION_API_KEY.slice(-4) : 'NOT SET');
    
    // Якщо ключ не вказаний в .env, повертаємо помилку конфігурації
    if (!process.env.INTEGRATION_API_KEY) {
        console.log('Error: INTEGRATION_API_KEY not configured in environment');
        return res.status(500).json({ 
            success: false,
            message: 'API authentication not configured' 
        });
    }

    // Перевірка API ключа
    if (!apiKey) {
        console.log('Error: API Key missing in request');
        return res.status(401).json({ 
            success: false,
            message: 'API key is required. Use X-API-Key header or Authorization: Bearer <key>' 
        });
    }

    if (apiKey !== process.env.INTEGRATION_API_KEY) {
        console.log('Error: Invalid API Key provided');
        return res.status(401).json({ 
            success: false,
            message: 'Invalid API key' 
        });
    }

    console.log('✅ API Key validated successfully');
    console.log('=== End Validation ===\n');
    next();
};

// POST /api/integration - Створення нового ліда через інтеграцію
router.post('/', validateApiKey, handleIntegrationWebhook);

module.exports = router;
