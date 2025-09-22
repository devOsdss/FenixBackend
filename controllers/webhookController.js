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
        console.log("RRRRRRRRRRRR:", formData);

        // Підтримка різного регістру полів
        const phoneField = formData.phone || formData.Phone || '';
        const nameField = formData.name || formData.Name || 'No Name';
        const emailField = formData.email || formData.Email || 'No Email';

        // Нормалізація номера телефону
        const normalizedPhone = phoneField ? phoneField.replace(/\D/g, '') : '';
        console.log('Normalized phone:', normalizedPhone || 'No phone provided');

        // Перевірка, чи існує лід з таким номером (якщо номер є)
        let existingLead = null;
        if (normalizedPhone) {
            existingLead = await Lead.findOne({ phone: normalizedPhone });
        }
        console.log('Existing lead:', existingLead ? 'Found' : 'Not found');

        // Визначення статусу
        const status = existingLead ? 'DUPLICATE' : 'UC_HSS56X';
        console.log('Assigned status:', status);

        // Створення нового ліда
        const lead = new Lead({
            name: nameField,
            phone: normalizedPhone || 'No Phone',
            email: emailField,
            status: status,
            sourceDescription: formData.source || req.headers.referer || 'No Source',
            utm_source: formData.utm_source || 'No UTM Source',
            utm_medium: formData.utm_medium || 'No UTM Medium',
            utm_campaign: formData.utm_campaign || 'No UTM Campaign',
            utm_content: formData.utm_content || 'No UTM Content',
            utm_term: formData.utm_term || 'No UTM Term',
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
