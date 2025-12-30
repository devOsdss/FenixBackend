const mongoose = require('mongoose');

const actionSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Заголовок обязателен'],
    trim: true,
    maxlength: [200, 'Заголовок не может быть длиннее 200 символов']
  },
  
  description: {
    type: String,
    trim: true,
    maxlength: [1000, 'Описание не может быть длиннее 1000 символов']
  },
  
  planDate: {
    type: Date,
    required: [true, 'Дата планирования обязательна']
  },
  
  leadId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Leads',
    required: [true, 'ID лида обязателен']
  },
  
  managerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin' || 'SuperAdmin',
    required: [true, 'ID менеджера обязателен']
  },
  
}, {
  timestamps: true // Adds createdAt and updatedAt automatically
});

// Indexes for better query performance
actionSchema.index({ leadId: 1 });
actionSchema.index({ managerId: 1 });
actionSchema.index({ planDate: 1 });
actionSchema.index({ createdAt: -1 });

// Virtual for checking if action is overdue
actionSchema.virtual('isOverdue').get(function() {
  return this.planDate < new Date();
});

// Static methods
actionSchema.statics.findByLead = function(leadId) {
  return this.find({ leadId }).populate('managerId', 'login').sort({ planDate: 1 });
};

actionSchema.statics.findByManager = function(managerId) {
  return this.find({ managerId }).populate('leadId', 'name phone').sort({ planDate: 1 });
};



actionSchema.statics.getOverdueActions = function() {
  return this.find({
    planDate: { $lt: new Date() }
  }).populate(['leadId', 'managerId']).sort({ planDate: 1 });
};

actionSchema.statics.getTodayActions = function() {
  const now = new Date();
  const KYIV_OFFSET_HOURS = 2;
  const startOfDay = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
    0 - KYIV_OFFSET_HOURS, 0, 0, 0
  ));
  const endOfDay = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
    23 - KYIV_OFFSET_HOURS, 59, 59, 999
  ));
  
  return this.find({
    planDate: { $gte: startOfDay, $lte: endOfDay }
  }).populate(['leadId', 'managerId']).sort({ planDate: 1 });
};

// Instance methods
actionSchema.methods.reschedule = function(newDate) {
  this.planDate = newDate;
  return this.save();
};

// Ensure virtuals are included when converting to JSON
actionSchema.set('toJSON', { virtuals: true });
actionSchema.set('toObject', { virtuals: true });

const Action = mongoose.model('Action', actionSchema);

module.exports = Action;