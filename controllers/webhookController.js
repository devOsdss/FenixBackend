const Lead = require('../models/Lead');

const handleTildaWebhook = async (req, res) => {
    console.log('\n=== Tilda Webhook Started ===');
    console.log('Request received at:', new Date().toISOString());
    console.log('Request URL:', req.originalUrl);
    console.log('Request Method:', req.method);
    
    try {
        console.log('\nRequest Headers:', JSON.stringify(req.headers, null, 2));
        console.log('\nRequest Query:', JSON.stringify(req.query, null, 2));
        console.log('\nRequest Body:', JSON.stringify(req.body, null, 2));
        
        const formData = req.body;
         console.log("RRRRRRRRRRRR:", formData)
        
        // Валідація обов'язкових полів
        // if (!formData.Phone) {
        //     console.log('Error: Phone number is missing');
        //     return res.status(400).json({ message: 'Phone number is required' });
        // }

        // Нормалізація номера телефону (видалення всіх символів крім цифр)
        const normalizedPhone = formData.Phone ? formData.Phone.replace(/\D/g, '') : "";
        console.log('Normalized phne:', normalizedPhone);

        // Перевірка чи існує лід з таким номером
        const existingLead = await Lead.findOne({ phone: formData.Phone });
        console.log('Existing lead:', existingLead ? 'Found' : 'Not found');
         console.log(`Phone number: ${formData.Phone}`)
        // Визначення статусу
        const status = existingLead ? 'DUPLICATE' : 'UC_HSS56X';

        
        console.log('Assigned status:', status);

        // Створення нового ліда
        const lead = new Lead({
            name: formData.Name || 'No Name',
            phone: normalizedPhone || ' No Phone',
            email: formData.Email || ' No Email',
            status: status || 'NEW',
            sourceDescription: formData.source || req.headers.referer || 'No Source',
            utm_source: formData.utm_source || 'No UTM Source',
            utm_medium: formData.utm_medium || 'No UTM Medium',
            utm_campaign: formData.utm_campaign || 'No UTM Campaign',
            utm_content: formData.utm_content || 'No UTM Content',
            utm_term: formData.utm_term || 'No UTM Term',
            dateCreate: new Date(),
            hidden:false
        });

        await lead.save();
        console.log('New lead saved with ID:', lead._id);

        // Відправка даних через WebSocket
        if (req.app.get('wss')) {
            const wss = req.app.get('wss');
            wss.clients.forEach((client) => {
                if (client.readyState === 1) {
                    client.send(JSON.stringify({
                        type: 'NEW_LEAD',
                        data: lead
                    }));
                }
            });
            console.log('WebSocket notification sent');
        }

        console.log('=== Tilda Webhook Completed Successfully ===\n');
        return res.status(200).json({ 
            message: 'Lead created successfully',
            status: status,
            leadId: lead._id
        });

    } catch (error) {
        console.error('\n=== Tilda Webhook Error ===');
        console.error('Error:', error);
        console.error('Stack:', error.stack);
        console.error('=== End Error ===\n');
        
        return res.status(500).json({ 
            message: 'Internal server error',
            error: error.message
        });
    }
};

module.exports = {
    handleTildaWebhook
};
