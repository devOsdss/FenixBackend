const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  // Login field - should match "First Last" format
  login: {
    type: String,
    required: [true, 'Логин обязателен'],
    unique: true,
    trim: true,
    validate: {
      validator: function(v) {
        // Check if it matches "First Last" format (exactly two words)
        const namePattern = /^[A-Za-zА-Яа-яЁё]+\s[A-Za-zА-Яа-яЁё]+$/;
        return namePattern.test(v);
      },
      message: 'Логин должен быть в формате "Имя Фамилия" (например, Denver Waxler)'
    }
  },
  
  // Password field
  password: {
    type: String,
    required: [true, 'Пароль обязателен'],
    minlength: [6, 'Пароль должен содержать минимум 6 символов']
  },
  
  // Additional user information
  email: {
    type: String,
    sparse: true, // Allow multiple null values
    lowercase: true,
  },
  
  // User role
  role: {
    type: String,
    enum: ['user', 'admin'],
    default: 'user'
  },
  
  // Account status
  isActive: {
    type: Boolean,
    default: true
  },
  
  // Timestamps
  lastLogin: {
    type: Date
  }
}, {
  timestamps: true // Adds createdAt and updatedAt automatically
});

// Index for faster queries
userSchema.index({ login: 1 });
userSchema.index({ email: 1 });

// Pre-save middleware to hash password (you'll need bcrypt for this)
userSchema.pre('save', function(next) {
  // TODO: Add password hashing with bcrypt
  // For now, just proceed
  next();
});

// Instance method to check password (you'll need bcrypt for this)
userSchema.methods.comparePassword = function(candidatePassword) {
  // TODO: Add password comparison with bcrypt
  // For now, just compare directly (NOT SECURE - implement bcrypt)
  return this.password === candidatePassword;
};

// Static method to find user by login
userSchema.statics.findByLogin = function(login) {
  return this.findOne({ login: login });
};

// Transform output (remove password from JSON responses)
userSchema.methods.toJSON = function() {
  const userObject = this.toObject();
  delete userObject.password;
  return userObject;
};

const User = mongoose.model('User', userSchema);

module.exports = User;
