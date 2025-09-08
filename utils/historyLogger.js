const LeadsHistory = require('../models/LeadsHistory');

/**
 * Helper function to log lead history entries
 * @param {Object} data - History entry data
 * @param {string} data.leadId - Lead ID
 * @param {string} data.actionType - Action type (from enum)
 * @param {string} data.description - Description of the action
 * @param {string} data.adminId - Admin ID who performed the action
 * @param {Object} data.metadata - Additional metadata (optional)
 * @param {string} data.photo - Photo URL (optional)
 */
async function logLeadHistory(data) {
  try {
    const historyEntry = new LeadsHistory({
      leadId: data.leadId,
      actionType: data.actionType,
      description: data.description,
      adminId: data.adminId,
      metadata: data.metadata || {},
      photo: data.photo || null,
      timestamp: new Date()
    });

    await historyEntry.save();
    console.log(`✅ History logged: ${data.actionType} for lead ${data.leadId}`);
    return historyEntry;
  } catch (error) {
    console.error('❌ Error logging lead history:', error);
    throw error;
  }
}

/**
 * Log lead creation
 */
async function logLeadCreated(leadId, adminId, leadData) {
  return await logLeadHistory({
    leadId,
    actionType: 'LEAD_CREATED',
    description: `Лід створено: ${leadData.name} (${leadData.phone})`,
    adminId,
    metadata: {
      initialStatus: leadData.status,
      source: leadData.sourceDescription,
      utm_source: leadData.utm_source
    }
  });
}

/**
 * Log status change
 */
async function logStatusChanged(leadId, adminId, oldStatus, newStatus, leadName) {
  return await logLeadHistory({
    leadId,
    actionType: 'STATUS_CHANGED',
    description: `Статус змінено з "${oldStatus}" на "${newStatus}"`,
    adminId,
    metadata: {
      oldStatus,
      newStatus,
      leadName
    }
  });
}

/**
 * Log assignment change
 */
async function logAssignmentChanged(leadId, adminId, oldAssigned, newAssigned, leadName) {
  const oldAssignedName = oldAssigned || 'Не призначено';
  const newAssignedName = newAssigned || 'Не призначено';
  
  return await logLeadHistory({
    leadId,
    actionType: 'ASSIGNED_TO_MANAGER',
    description: `Відповідального змінено з "${oldAssignedName}" на "${newAssignedName}"`,
    adminId,
    metadata: {
      oldAssigned,
      newAssigned,
      leadName
    }
  });
}

/**
 * Log comment/note addition
 */
async function logCommentAdded(leadId, adminId, noteText, leadName, photo = null) {
  return await logLeadHistory({
    leadId,
    actionType: 'COMMENT_ADDED',
    description: photo ? 
      `Додано коментар з фото: ${noteText.substring(0, 100)}${noteText.length > 100 ? '...' : ''}` :
      `Додано коментар: ${noteText.substring(0, 100)}${noteText.length > 100 ? '...' : ''}`,
    adminId,
    photo,
    metadata: {
      leadName,
      fullText: noteText,
      hasPhoto: !!photo
    }
  });
}

/**
 * Log lead update
 */
async function logLeadUpdated(leadId, adminId, changes, leadName) {
  const changesList = Object.keys(changes).map(key => {
    if (key === 'status') return `статус: ${changes[key]}`;
    if (key === 'assigned') return `відповідальний: ${changes[key]}`;
    if (key === 'name') return `ім'я: ${changes[key]}`;
    if (key === 'phone') return `телефон: ${changes[key]}`;
    if (key === 'email') return `email: ${changes[key]}`;
    return `${key}: ${changes[key]}`;
  }).join(', ');

  return await logLeadHistory({
    leadId,
    actionType: 'LEAD_UPDATED',
    description: `Оновлено дані ліда: ${changesList}`,
    adminId,
    metadata: {
      changes,
      leadName
    }
  });
}

/**
 * Log contact info update
 */
async function logContactInfoUpdated(leadId, adminId, changes, leadName) {
  const changesList = [];
  if (changes.name) changesList.push(`ім'я: ${changes.name}`);
  if (changes.phone) changesList.push(`телефон: ${changes.phone}`);
  if (changes.email) changesList.push(`email: ${changes.email}`);

  return await logLeadHistory({
    leadId,
    actionType: 'CONTACT_INFO_UPDATED',
    description: `Оновлено контактну інформацію: ${changesList.join(', ')}`,
    adminId,
    metadata: {
      changes,
      leadName
    }
  });
}

/**
 * Log lead deletion/hiding
 */
async function logLeadHidden(leadId, adminId, leadName) {
  return await logLeadHistory({
    leadId,
    actionType: 'LEAD_HIDDEN',
    description: `Лід приховано`,
    adminId,
    metadata: {
      leadName
    }
  });
}

/**
 * Log lead unhiding
 */
async function logLeadUnhidden(leadId, adminId, leadName) {
  return await logLeadHistory({
    leadId,
    actionType: 'LEAD_UNHIDDEN',
    description: `Лід відновлено`,
    adminId,
    metadata: {
      leadName
    }
  });
}

module.exports = {
  logLeadHistory,
  logLeadCreated,
  logStatusChanged,
  logAssignmentChanged,
  logCommentAdded,
  logLeadUpdated,
  logContactInfoUpdated,
  logLeadHidden,
  logLeadUnhidden
};
