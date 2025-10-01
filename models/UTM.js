const mongoose = require('mongoose');

const utmSourceSchema = new mongoose.Schema({
  label: {
    type: String,
    required: [true, 'Назва UTM джерела є обов\'язковою'],
    trim: true,
    maxlength: [100, 'Назва не може перевищувати 100 символів']
  },
  value: {
    type: String,
    required: [true, 'Значення UTM джерела є обов\'язковим'],
    trim: true,
    maxlength: [100, 'Значення не може перевищувати 100 символів']
  },
  description: {
    type: String,
    trim: true,
    maxlength: [500, 'Опис не може перевищувати 500 символів']
  },
  category: {
    type: String,
    enum: ['social', 'email', 'advertising', 'referral', 'direct', 'organic', 'other'],
    default: 'other'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  priority: {
    type: Number,
    default: 0,
    min: [0, 'Пріоритет не може бути менше 0']
  }
}, {
  timestamps: true,
  collection: 'utm_sources' // Явно вказуємо назву колекції
});

// Індекси для оптимізації запитів
utmSourceSchema.index({ value: 1 });
utmSourceSchema.index({ isActive: 1 });
utmSourceSchema.index({ category: 1 });
utmSourceSchema.index({ priority: -1 });

// Віртуальне поле для перевірки активності
utmSourceSchema.virtual('isEnabled').get(function() {
  return this.isActive;
});

// Статичні методи
utmSourceSchema.statics.findActive = function() {
  return this.find({ isActive: true }).sort({ priority: -1, label: 1 });
};

utmSourceSchema.statics.findByCategory = function(category) {
  return this.find({ category, isActive: true }).sort({ priority: -1, label: 1 });
};

utmSourceSchema.statics.getOptions = function() {
  return this.find({ isActive: true })
    .select('label value category')
    .sort({ priority: -1, label: 1 });
};

// Методи екземпляра
utmSourceSchema.methods.activate = function() {
  this.isActive = true;
  return this.save();
};

utmSourceSchema.methods.deactivate = function() {
  this.isActive = false;
  return this.save();
};

utmSourceSchema.methods.toggle = function() {
  this.isActive = !this.isActive;
  return this.save();
};

// Middleware для валідації унікальності value
utmSourceSchema.pre('save', async function(next) {
  if (this.isModified('value')) {
    const existingUTM = await this.constructor.findOne({
      value: this.value,
      _id: { $ne: this._id }
    });
    
    if (existingUTM) {
      const error = new Error('UTM джерело з таким значенням вже існує');
      error.code = 'DUPLICATE_VALUE';
      return next(error);
    }
  }
  next();
});

// Експорт моделі
module.exports = mongoose.model('UTMSource', utmSourceSchema);