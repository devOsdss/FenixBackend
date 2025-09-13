const Lead = require('../models/Lead');

function normalizePhone(phone) {
    return phone.replace(/\D/g, ''); // Видаляє всі символи, крім цифр
}

const processTildaWebhook = async (req, res) => {
    try {
        console.log('Received webhook from Tilda:', req.body);
        const formData = req.body;
        console.log("RDRDRDDRDD:", formData)
        let sourceDescription = 'Unknown Source';

        try {
            const referer = req.headers['referer'];
            if (referer) {
                const urlObject = new URL(referer);
                sourceDescription = urlObject.hostname;
            }
        } catch (urlError) {
            console.warn('⚠️ Не вдалося розпарсити referer:', req.headers['referer']);
        }

        console.log('formData:', formData);
      
        console.log('Source description:', sourceDescription);
        const leadData = {
            name: formData.Name || formData.name || 'No Name',
            phone: normalizePhone(formData.Phone || formData.phone || formData.PHONE || ''),
            email: formData.Email || formData.email ||  formData.EMAIL || 'No Email',
            formName: formData.formname || null,
            formId: formData.formid || null,
            sourceDescription: sourceDescription,  
            referer: null, 
            formData: new Map(),
            status: 'UC_HSS56X',
            hidden: false,
            dateCreate: new Date(),
            updatedAt: new Date()
        };

        console.log('Lead data:', leadData);

        for (const [key, value] of Object.entries(formData)) {
            if (!['Name', 'Phone', 'Email', 'formname', 'formid', 'pageurl', 'referer', 'trantoken'].includes(key)) {
                leadData.formData.set(key, value);
            }
        }

        const existingLead = await Lead.findOne({ phone: leadData.phone });
        
        if (existingLead) {
            leadData.originalLeadId = existingLead._id;
            leadData.status = 'DUPLICATE';
            console.log('Duplicate lead detected:', existingLead._id);
        }

        const newLead = new Lead(leadData);
        await newLead.save();
        console.log('Lead saved:', {
            id: newLead._id,
            name: newLead.name,
            phone: newLead.phone,
            status: newLead.status
        });

        return res.status(200).json({
            status: 'success',
            message: 'Lead data received and processed successfully',
            leadId: newLead._id
        });
    } catch (error) {
        console.error('Error processing Tilda webhook:', error);
        return res.status(500).json({ 
            status: 'error',
            message: 'Error processing lead data',
            error: error.message
        });
    }
};

module.exports = {
    processTildaWebhook
};
