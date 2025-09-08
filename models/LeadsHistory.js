const mongoose = require('mongoose');

const leadsHistorySchema = new mongoose.Schema({
  leadId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Lead',
    required: true,
    index: true
  },
  actionType: {
    type: String,
    required: true,
    enum: [
      'COMMENT_ADDED',
      'STATUS_CHANGED',
      'ASSIGNED_TO_MANAGER',
      'LEAD_CREATED',
      'LEAD_UPDATED',
      'LEAD_DELETED',
      'LEAD_HIDDEN',
      'LEAD_UNHIDDEN',
      'EMAIL_SENT',
      'CALL_MADE',
      'NOTE_ADDED',
      'PRIORITY_CHANGED',
      'SOURCE_UPDATED',
      'CONTACT_INFO_UPDATED',
      'LEAD_TRANSFERRED',
      'ACTION_CREATED'
    ],
    index: true
  },
  description: {
    type: String,
    required: true,
    trim: true,
    maxlength: 1000
  },
  adminId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin',
    required: true,
    index: true
  },
  photo: {
    type: String,
    default: null
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  timestamp: {
    type: Date,
    default: Date.now,
    index: true
  }
}, {
  timestamps: true,
  versionKey: '__v'
});

// Compound indexes for better query performance
leadsHistorySchema.index({ leadId: 1, timestamp: -1 });
leadsHistorySchema.index({ adminId: 1, timestamp: -1 });
leadsHistorySchema.index({ actionType: 1, timestamp: -1 });

// Virtual for formatted timestamp
leadsHistorySchema.virtual('formattedTimestamp').get(function() {
  return this.timestamp.toLocaleString('uk-UA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
});

// Static method to get history for a specific lead
leadsHistorySchema.statics.getLeadHistory = function(leadId, limit = 50, skip = 0) {
  return this.find({ leadId })
    .populate('adminId', 'name email')
    .sort({ timestamp: -1 })
    .limit(limit)
    .skip(skip)
    .lean();
};

// Static method to get history by action type
leadsHistorySchema.statics.getHistoryByActionType = function(actionType, limit = 100, skip = 0) {
  return this.find({ actionType })
    .populate('leadId', 'name phone email')
    .populate('adminId', 'name email')
    .sort({ timestamp: -1 })
    .limit(limit)
    .skip(skip)
    .lean();
};

// Static method to get admin activity
leadsHistorySchema.statics.getAdminActivity = function(adminId, limit = 100, skip = 0) {
  return this.find({ adminId })
    .populate('leadId', 'name phone email')
    .sort({ timestamp: -1 })
    .limit(limit)
    .skip(skip)
    .lean();
};

// Static method to create history entry
leadsHistorySchema.statics.createHistoryEntry = function(data) {
  const historyEntry = new this({
    leadId: data.leadId,
    actionType: data.actionType,
    description: data.description,
    adminId: data.adminId,
    metadata: data.metadata || {},
    timestamp: data.timestamp || new Date()
  });
  
  return historyEntry.save();
};

// Instance method to format for API response
leadsHistorySchema.methods.toAPIResponse = function() {
  return {
    _id: this._id,
    leadId: this.leadId,
    actionType: this.actionType,
    description: this.description,
    adminId: this.adminId,
    metadata: this.metadata,
    timestamp: this.timestamp,
    formattedTimestamp: this.formattedTimestamp,
    __v: this.__v
  };
};

// Pre-save middleware to ensure description is properly formatted
leadsHistorySchema.pre('save', function(next) {
  if (this.description) {
    this.description = this.description.trim();
  }
  next();
});

const LeadsHistory = mongoose.model('LeadsHistory', leadsHistorySchema, 'leadhistories');

module.exports = LeadsHistory;