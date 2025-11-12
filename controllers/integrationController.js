const Lead = require('../models/Lead');

const handleIntegrationWebhook = async (req, res) => {
    console.log('\n=== Integration Webhook Started ===');
    console.log('Request received at:', new Date().toISOString());
    console.log('Request URL:', req.originalUrl);
    console.log('Request Method:', req.method);
    
    try {
        console.log('\nRequest Headers:', JSON.stringify(req.headers, null, 2));
        console.log('\nRequest Body:', JSON.stringify(req.body, null, 2));
        
        const { name, phone, email, sourceDescription, utm_source, utm_medium, utm_campaign, utm_content, utm_term } = req.body;
        
        console.log("Integration data received:", {
            name,
            phone,
            email,
            sourceDescription,
            utm_source
        });
        
        // Валідація обов'язкових полів
        if (!phone) {
            console.log('Error: Phone number is missing');
            return res.status(400).json({ 
                success: false,
                message: 'Phone number is required' 
            });
        }

        if (!name) {
            console.log('Error: Name is missing');
            return res.status(400).json({ 
                success: false,
                message: 'Name is required' 
            });
        }

        // Нормалізація номера телефону (видалення всіх символів крім цифр)
        const normalizedPhone = phone.replace(/\D/g, '');
        console.log('Original phone:', phone);
        console.log('Normalized phone:', normalizedPhone);

        // Перевірка чи існує лід з таким нормалізованим номером
        const existingLead = await Lead.findOne({ phone: normalizedPhone });
        console.log('Existing lead check result:', existingLead ? 'DUPLICATE FOUND' : 'NEW LEAD');
        
        if (existingLead) {
            console.log('Duplicate lead found with ID:', existingLead._id);
            console.log('Existing lead phone:', existingLead.phone);
        }
        
        // Визначення статусу
        const status = existingLead ? 'DUPLICATE' : 'UC_HSS56X';

        console.log('Final assigned status:', status);
        console.log('Status reason:', existingLead ? 'Phone number already exists in database' : 'New unique phone number');

        // Створення нового ліда
        const lead = new Lead({
            name: name,
            phone: normalizedPhone,
            email: email || 'No Email',
            status: status,
            sourceDescription: sourceDescription || 'No Source',
            utm_source: utm_source || 'No UTM Source',
            utm_medium: utm_medium || 'No UTM Medium',
            utm_campaign: utm_campaign || 'No UTM Campaign',
            utm_content: utm_content || 'No UTM Content',
            utm_term: utm_term || 'No UTM Term',
            department: 11,
            dateCreate: new Date(),
            hidden: false
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

        console.log('=== Integration Webhook Completed Successfully ===\n');
        return res.status(200).json({ 
            success: true,
            message: 'Lead created successfully',
            status: status,
            leadId: lead._id,
            isDuplicate: existingLead ? true : false
        });

    } catch (error) {
        console.error('\n=== Integration Webhook Error ===');
        console.error('Error:', error);
        console.error('Stack:', error.stack);
        console.error('=== End Error ===\n');
        
        return res.status(500).json({ 
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
};

module.exports = {
    handleIntegrationWebhook
};
