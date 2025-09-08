const mongoose = require('mongoose');

const sourceSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    required: false,
    trim: true
  },
  type: {
    type: String,
    required: true,
    enum: ['website', 'social', 'advertising', 'referral', 'direct', 'other'],
    default: 'website'
  },
  url: {
    type: String,
    required: false,
    trim: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  priority: {
    type: Number,
    default: 0
  },
  // Legacy fields for backward compatibility
  value: {
    type: String,
    required: false,
    trim: true
  },
  label: {
    type: String,
    required: false,
    trim: true
  },
  tildaUrl: {
    type: String,
    required: false,
    trim: true
  }
}, {
  timestamps: true // This automatically adds createdAt and updatedAt fields
});

// Add indexes for better query performance
sourceSchema.index({ name: 1 });
sourceSchema.index({ type: 1 });
sourceSchema.index({ isActive: 1 });
sourceSchema.index({ priority: 1 });
// Legacy indexes
sourceSchema.index({ value: 1 });
sourceSchema.index({ label: 1 });

// Virtual for formatted URL (removes protocol and www)
sourceSchema.virtual('formattedUrl').get(function() {
  if (!this.url) return '';
  return this.url.replace(/^(https?:\/\/)?(www\.)?/, '');
});

// Instance method to check if source is active
sourceSchema.methods.isSourceActive = function() {
  return this.isActive;
};

// Static method to find by domain
sourceSchema.statics.findByDomain = function(domain) {
  const regex = new RegExp(domain.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
  return this.find({
    $or: [
      { url: regex },
      { name: regex },
      { value: regex },
      { label: regex }
    ]
  });
};

// Static method to get source options for dropdowns
sourceSchema.statics.getSourceOptions = async function() {
  const sources = await this.find({ isActive: true })
    .select('_id name type')
    .sort({ priority: 1, name: 1 });
  
  return sources.map(source => ({
    value: source._id,
    label: source.name,
    type: source.type
  }));
};

// Use correct collection name 'source'
const Source = mongoose.model('Source', sourceSchema, 'source');

module.exports = Source;