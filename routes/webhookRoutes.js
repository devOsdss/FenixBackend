const express = require('express');
const router = express.Router();
const { handleTildaWebhook } = require('../controllers/webhookController');

// Middleware для валідації запитів від тільди
const validateTildaRequest = (req, res, next) => {
    const publicKey = req.headers['x-tilda-public-key'];
    
    // Якщо ключ не вказаний в .env, пропускаємо перевірку
    if (!process.env.TILDA_PUBLIC_KEY) {
        return next();
    }

    if (publicKey !== process.env.TILDA_PUBLIC_KEY) {
        return res.status(401).json({ message: 'Invalid public key' });
    }

    next();
};

router.post('/', validateTildaRequest, handleTildaWebhook);

module.exports = router;
