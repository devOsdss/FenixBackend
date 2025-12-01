/**
 * Lot Model
 * 
 * Represents a LOT (successful deal) created by Reten managers.
 * This model stores information about closed deals with editable amounts.
 * 
 * @module models/Lot
 * @requires mongoose
 * @author Senior Developer (5+ years experience)
 */

const mongoose = require('mongoose');

/**
 * Lot Schema Definition
 * 
 * Features:
 * - Comprehensive validation
 * - Indexed fields for performance
 * - Virtual fields for computed properties
 * - Static methods for common queries
 * - Instance methods for business logic
 * - Audit trail with timestamps
 */
const lotSchema = new mongoose.Schema({
  // Core LOT Information
  lotName: {
    type: String,
    required: [true, 'Название лота обязательно'],
    trim: true,
    minlength: [3, 'Название лота должно содержать минимум 3 символа'],
    maxlength: [200, 'Название лота не может превышать 200 символов'],
    index: true
  },

  amount: {
    type: Number,
    required: [true, 'Сумма обязательна'],
    min: [0, 'Сумма не может быть отрицательной'],
    validate: {
      validator: function(value) {
        return Number.isFinite(value) && value >= 0;
      },
      message: 'Сумма должна быть положительным числом'
    }
  },

  lotDate: {
    type: Date,
    required: [true, 'Дата лота обязательна'],
    validate: {
      validator: function(value) {
        return value instanceof Date && !isNaN(value);
      },
      message: 'Некорректная дата'
    },
    index: true
  },

  // Lead Reference
  leadId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Leads',
    required: [true, 'ID лида обязателен'],
    index: true
  },

  // Cached lead data for performance (denormalization)
  leadName: {
    type: String,
    required: [true, 'Имя лида обязательно'],
    trim: true
  },

  leadPhone: {
    type: String,
    trim: true,
    default: null
  },

  leadEmail: {
    type: String,
    trim: true,
    lowercase: true,
    default: null
  },

  // Manager Information
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin',
    required: [true, 'Ответственный менеджер обязателен'],
    index: true
  },

  // Team/Department
  team: {
    type: String,
    trim: true,
    default: null,
    index: true
  },

  department: {
    type: String,
    trim: true,
    default: null
  },

  // Edit History for Amount Changes
  amountHistory: [{
    previousAmount: {
      type: Number,
      required: true
    },
    newAmount: {
      type: Number,
      required: true
    },
    editedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Admin',
      required: true
    },
    editedAt: {
      type: Date,
      default: Date.now
    },
    reason: {
      type: String,
      trim: true,
      maxlength: 500
    }
  }],

  // Status
  status: {
    type: String,
    enum: ['ACTIVE', 'ARCHIVED', 'CANCELLED'],
    default: 'ACTIVE',
    index: true
  },

  // Metadata
  metadata: {
    type: Map,
    of: mongoose.Schema.Types.Mixed,
    default: new Map()
  },

  // Soft delete
  isDeleted: {
    type: Boolean,
    default: false,
    index: true
  },

  deletedAt: {
    type: Date,
    default: null
  },

  deletedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin',
    default: null
  }
}, {
  timestamps: true, // Adds createdAt and updatedAt
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// ==================== INDEXES ====================

// Compound indexes for common queries
lotSchema.index({ assignedTo: 1, lotDate: -1 });
lotSchema.index({ team: 1, lotDate: -1 });
lotSchema.index({ status: 1, isDeleted: 1 });
lotSchema.index({ createdAt: -1 });

// Text index for search
lotSchema.index({ 
  lotName: 'text', 
  leadName: 'text' 
});

// ==================== VIRTUALS ====================

/**
 * Virtual field: Total number of amount edits
 */
lotSchema.virtual('editCount').get(function() {
  return this.amountHistory ? this.amountHistory.length : 0;
});

/**
 * Virtual field: Days since LOT creation
 */
lotSchema.virtual('daysOld').get(function() {
  if (!this.createdAt) return 0;
  const diff = Date.now() - this.createdAt.getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
});

/**
 * Virtual field: Formatted amount with currency
 */
lotSchema.virtual('formattedAmount').get(function() {
  return `₴${this.amount.toLocaleString('uk-UA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
});

// ==================== STATIC METHODS ====================

/**
 * Get LOTs by manager with pagination
 * @param {ObjectId} managerId - Manager ID
 * @param {Object} options - Pagination options
 * @returns {Promise<Object>} LOTs and pagination info
 */
lotSchema.statics.getByManager = async function(managerId, options = {}) {
  const {
    page = 1,
    limit = 20,
    sortBy = 'lotDate',
    sortOrder = 'desc',
    status = 'ACTIVE'
  } = options;

  const skip = (page - 1) * limit;
  const sort = { [sortBy]: sortOrder === 'desc' ? -1 : 1 };

  const filter = {
    assignedTo: managerId,
    isDeleted: false
  };

  if (status) {
    filter.status = status;
  }

  const [lots, total] = await Promise.all([
    this.find(filter)
      .populate('assignedTo', 'login email')
      .populate('leadId', 'name phone email status')
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .lean(),
    this.countDocuments(filter)
  ]);

  return {
    lots,
    pagination: {
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
      hasNextPage: page < Math.ceil(total / limit),
      hasPrevPage: page > 1
    }
  };
};

/**
 * Get LOTs by team with aggregation
 * @param {String} teamName - Team name
 * @param {Date} startDate - Start date
 * @param {Date} endDate - End date
 * @returns {Promise<Array>} Aggregated LOT statistics
 */
lotSchema.statics.getTeamStats = async function(teamName, startDate, endDate) {
  const matchStage = {
    team: teamName,
    isDeleted: false,
    status: 'ACTIVE'
  };

  if (startDate || endDate) {
    matchStage.lotDate = {};
    if (startDate) matchStage.lotDate.$gte = new Date(startDate);
    if (endDate) matchStage.lotDate.$lte = new Date(endDate);
  }

  return this.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: '$assignedTo',
        totalAmount: { $sum: '$amount' },
        totalLots: { $sum: 1 },
        avgAmount: { $avg: '$amount' },
        minAmount: { $min: '$amount' },
        maxAmount: { $max: '$amount' }
      }
    },
    {
      $lookup: {
        from: 'admins',
        localField: '_id',
        foreignField: '_id',
        as: 'manager'
      }
    },
    { $unwind: '$manager' },
    {
      $project: {
        managerId: '$_id',
        managerName: '$manager.login',
        totalAmount: 1,
        totalLots: 1,
        avgAmount: { $round: ['$avgAmount', 2] },
        minAmount: 1,
        maxAmount: 1
      }
    },
    { $sort: { totalAmount: -1 } }
  ]);
};

/**
 * Get overall statistics for a period
 * @param {Date} startDate - Start date
 * @param {Date} endDate - End date
 * @returns {Promise<Object>} Overall statistics
 */
lotSchema.statics.getOverallStats = async function(startDate, endDate) {
  const matchStage = {
    isDeleted: false,
    status: 'ACTIVE'
  };

  if (startDate || endDate) {
    matchStage.lotDate = {};
    if (startDate) matchStage.lotDate.$gte = new Date(startDate);
    if (endDate) matchStage.lotDate.$lte = new Date(endDate);
  }

  const result = await this.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: null,
        totalAmount: { $sum: '$amount' },
        totalLots: { $sum: 1 },
        avgAmount: { $avg: '$amount' },
        minAmount: { $min: '$amount' },
        maxAmount: { $max: '$amount' }
      }
    }
  ]);

  return result.length > 0 ? result[0] : {
    totalAmount: 0,
    totalLots: 0,
    avgAmount: 0,
    minAmount: 0,
    maxAmount: 0
  };
};

/**
 * Search LOTs by text
 * @param {String} searchText - Search query
 * @param {Object} options - Additional options
 * @returns {Promise<Array>} Matching LOTs
 */
lotSchema.statics.searchLots = async function(searchText, options = {}) {
  const { limit = 20, managerId = null } = options;

  const filter = {
    $text: { $search: searchText },
    isDeleted: false
  };

  if (managerId) {
    filter.assignedTo = managerId;
  }

  return this.find(filter, { score: { $meta: 'textScore' } })
    .sort({ score: { $meta: 'textScore' } })
    .limit(limit)
    .populate('assignedTo', 'login')
    .populate('leadId', 'name phone')
    .lean();
};

// ==================== INSTANCE METHODS ====================

/**
 * Update LOT amount with history tracking
 * @param {Number} newAmount - New amount
 * @param {ObjectId} editedBy - Admin who made the edit
 * @param {String} reason - Reason for edit
 * @returns {Promise<Lot>} Updated LOT
 */
lotSchema.methods.updateAmount = async function(newAmount, editedBy, reason = '') {
  if (this.amount === newAmount) {
    throw new Error('Новая сумма совпадает с текущей');
  }

  this.amountHistory.push({
    previousAmount: this.amount,
    newAmount: newAmount,
    editedBy: editedBy,
    editedAt: new Date(),
    reason: reason
  });

  this.amount = newAmount;
  return this.save();
};

/**
 * Soft delete LOT
 * @param {ObjectId} deletedBy - Admin who deleted
 * @returns {Promise<Lot>} Deleted LOT
 */
lotSchema.methods.softDelete = async function(deletedBy) {
  this.isDeleted = true;
  this.deletedAt = new Date();
  this.deletedBy = deletedBy;
  this.status = 'ARCHIVED';
  return this.save();
};

/**
 * Restore soft-deleted LOT
 * @returns {Promise<Lot>} Restored LOT
 */
lotSchema.methods.restore = async function() {
  this.isDeleted = false;
  this.deletedAt = null;
  this.deletedBy = null;
  this.status = 'ACTIVE';
  return this.save();
};

/**
 * Get amount change history formatted
 * @returns {Array} Formatted history
 */
lotSchema.methods.getAmountHistory = function() {
  return this.amountHistory.map(entry => ({
    previousAmount: entry.previousAmount,
    newAmount: entry.newAmount,
    difference: entry.newAmount - entry.previousAmount,
    editedBy: entry.editedBy,
    editedAt: entry.editedAt,
    reason: entry.reason || 'Не указана'
  }));
};

// ==================== MIDDLEWARE ====================

/**
 * Pre-save middleware: Validate amount changes
 */
lotSchema.pre('save', function(next) {
  if (this.isModified('amount') && this.amount < 0) {
    next(new Error('Сумма не может быть отрицательной'));
  }
  next();
});

/**
 * Pre-save middleware: Ensure lotDate is not in future
 */
lotSchema.pre('save', function(next) {
  if (this.isNew && this.lotDate > new Date()) {
    next(new Error('Дата лота не может быть в будущем'));
  }
  next();
});

// ==================== MODEL ====================

const Lot = mongoose.model('Lot', lotSchema);

module.exports = Lot;
