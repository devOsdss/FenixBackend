/**
 * Приклад інтеграції з CRM через JavaScript/Node.js
 */

const API_URL = 'https://your-domain.com/api/integration';
const API_KEY = 'your_api_key_here';

/**
 * Відправка ліда в CRM
 */
async function sendLeadToCRM(leadData) {
    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-API-Key': API_KEY
            },
            body: JSON.stringify({
                name: leadData.name,
                phone: leadData.phone,
                email: leadData.email || 'No Email',
                sourceDescription: leadData.location || 'No Location',
                utm_source: 'your_partner_name', // Ваша унікальна мітка
                utm_medium: leadData.utm_medium || '',
                utm_campaign: leadData.utm_campaign || '',
                utm_content: leadData.utm_content || '',
                utm_term: leadData.utm_term || ''
            })
        });

        const result = await response.json();

        if (response.ok) {
            console.log('✅ Лід успішно відправлено:', result.leadId);
            
            if (result.isDuplicate) {
                console.log('⚠️ Увага: Це дублікат існуючого ліда');
            }
            
            return {
                success: true,
                leadId: result.leadId,
                isDuplicate: result.isDuplicate
            };
        } else {
            console.error('❌ Помилка відправки ліда:', result.message);
            return {
                success: false,
                error: result.message
            };
        }
    } catch (error) {
        console.error('❌ Помилка з\'єднання:', error.message);
        return {
            success: false,
            error: error.message
        };
    }
}

// Приклад використання
const exampleLead = {
    name: 'Іван Петренко',
    phone: '+380501234567',
    email: 'ivan@example.com',
    location: 'Київ, Україна'
};

sendLeadToCRM(exampleLead)
    .then(result => {
        if (result.success) {
            console.log('Лід створено з ID:', result.leadId);
        } else {
            console.log('Помилка:', result.error);
        }
    });
