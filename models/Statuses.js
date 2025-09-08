const mongoose = require('mongoose');

// Status schema for leads
const statusSchema = new mongoose.Schema({
  value: {
    type: String,
    required: true,
    unique: true,
    uppercase: true
  },
  label: {
    type: String,
    required: true
  },
  color: {
    type: String,
    required: true,
    validate: {
      validator: function(v) {
        return /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(v);
      },
      message: 'Color must be a valid hex color'
    }
  },
  description: {
    type: String,
    default: ''
  },
  roleView:{
    type: String,
    default: 'all'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  sortOrder: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

// Create indexes
statusSchema.index({ value: 1 });
statusSchema.index({ isActive: 1 });
statusSchema.index({ sortOrder: 1 });

// Static method to get all active statuses
statusSchema.statics.getActiveStatuses = function() {
  return this.find({ isActive: true }).sort({ sortOrder: 1 });
};

// Static method to get status by value
statusSchema.statics.getByValue = function(value) {
  return this.findOne({ value: value.toUpperCase(), isActive: true });
};



// Static method to get status options for frontend
statusSchema.statics.getStatusOptions = async function() {
  try {
    const statuses = await this.getActiveStatuses();
    return statuses.map(status => ({
      value: status.value,
      label: status.label,
      color: status.color,
      description: status.description
    }));
  } catch (error) {
    console.error('Error getting status options:', error);
    return [];
  }
};

// Static method to validate status
statusSchema.statics.isValidStatus = async function(statusValue) {
  if (!statusValue) return false;
  const status = await this.getByValue(statusValue);
  return !!status;
};

// Instance method to get color without #
statusSchema.methods.getColorWithoutHash = function() {
  return this.color.replace('#', '');
};

// Pre-save middleware to ensure uppercase value
statusSchema.pre('save', function(next) {
  if (this.value) {
    this.value = this.value.toUpperCase();
  }
  next();
});

const Status = mongoose.model('Status', statusSchema);

module.exports = Status;