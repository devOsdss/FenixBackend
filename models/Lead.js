const mongoose = require('mongoose');

const leadSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Имя обязательно'],
    trim: true
  },
  
  phone: {
    type: String,
    required: false,
    trim: true
  },
  
  email: {
    type: String,
    default: null,
  },
  
  assigned: {
    type: String,
    default: null
  },
  
  sourceDescription: {
    type: String,
    default: ""
  },
  
  department: {
    type: Number,
    default: null
  },
  
  originalLeadId: { 
    type: String,
    default: null
  },
  
  status: {
    type: String,
    default: 'NEW'
  },
  
  bitrixId: {
    type: String,
    default: null
  },
  
  notes: [{
    text: {
      type: String,
      required: false
    },
    photo: {
      type: String,
      default: null
    },
    createdAt: {
      type: Date,
      default: Date.now
    },
    adminId: {
      type: String,
      default: null
    }
  }],
  
  dateCreate: {
    type: Date,
    default: Date.now
  },
  
  utm_source: {
    type: String,
    default: ""
  },
  
  dateOfReten: {
    type: Date,
    default: null
  },
  
  normalizedPhone: {
    type: String,
    default: function() {
      return this.phone;
    }
  },
  
  hidden: {
    type: Boolean,
    default: false
  },
  
  updatedByNote: {
    type: String,
    default: null
  },
  
  updatedAt: {
    type: Date,
    default: Date.now
  },
  
  teamLeadAssignedAt: {
    type: Date,
    default: null
  }
}, {
  collection: 'customers', // Explicitly set collection name
  timestamps: false // We're managing timestamps manually
});

// Pre-save middleware to update timestamps and normalize phone
leadSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  
  // Normalize phone if it changed - remove all non-digit characters
  if (this.isModified('phone')) {
    this.normalizedPhone = this.phone.replace(/\D/g, '');
  }
  
  next();
});

// Indexes for better performance
leadSchema.index({ phone: 1 });
leadSchema.index({ email: 1 });
leadSchema.index({ status: 1 });
leadSchema.index({ assigned: 1 });
leadSchema.index({ bitrixId: 1 });
leadSchema.index({ dateCreate: -1 });
leadSchema.index({ updatedAt: -1 });
leadSchema.index({ department: 1 });



// Static methods
leadSchema.statics.findByPhone = function(phone) {
  return this.findOne({ phone: phone });
};

leadSchema.statics.findByStatus = function(status) {
  return this.find({ status: status, hidden: { $ne: true } });
};

leadSchema.statics.findByAssigned = function(assignedId) {
  return this.find({ assigned: assignedId, hidden: { $ne: true } });
};

leadSchema.statics.getActiveLeads = function() {
  return this.find({ 
    hidden: { $ne: true },
    status: { $in: ['NEW', 'IN_PROCESS'] }
  }).sort({ dateCreate: -1 });
};

// Instance methods
leadSchema.methods.addNote = function(noteText, adminId = null, photo = null) {
  // Require either text or photo
  if (!noteText && !photo) {
    throw new Error('Either text or photo is required for a note');
  }
  
  this.notes.push({
    text: noteText || '',
    photo: photo,
    createdAt: new Date(),
    adminId: adminId
  });
  this.updatedByNote = noteText || 'Додано фото';
  this.updatedAt = new Date();
  return this.save();
};

leadSchema.methods.updateStatus = function(newStatus) {
  this.status = newStatus;
  this.updatedAt = new Date();
  return this.save();
};

leadSchema.methods.assignTo = function(assignedId) {
  this.assigned = assignedId;
  this.updatedAt = new Date();
  return this.save();
};

const Lead = mongoose.model('Leads', leadSchema, 'customers');

module.exports = Lead;
