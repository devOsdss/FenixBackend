const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const adminSchema = new mongoose.Schema({
  login: {
    type: String,
    required: [true, 'Логин обязателен'],
    unique: true,
    trim: true
  },
  
  password: {
    type: String,
    required: [true, 'Пароль обязателен'],
    minlength: [6, 'Пароль должен содержать минимум 6 символов']
  },
  
  role: {
    type: String,
    enum: ['Admin', 'Manager', "Reten", "TeamLead", "SuperAdmin"],
    default: 'User'
  },
  
  create_ad: {
    type: Date,
    default: Date.now
  },
  
  responsible: {
    type: String,
    default: null
  },
  
  refreshToken: {
    type: String,
    default: null
  },
  
  department: {
    type: Number,
    default: null
  },
  
  bitrixId: {
    type: String,
    default: null
  },
  
  team: {
    type: String,
    default: null
  },
  
  avatar: {
    type: String,
    default: null
  }
}, {
  collection: 'admins', // Explicitly set collection name
  timestamps: false, // We're using create_ad instead of createdAt
  versionKey: '__v' // Keep __v field with default name
});

// Indexes for better performance
adminSchema.index({ login: 1 });
adminSchema.index({ role: 1 });
adminSchema.index({ department: 1 });
adminSchema.index({ bitrixId: 1 });
adminSchema.index({ team: 1 });

// Static methods
adminSchema.statics.findByLogin = function(login) {
  return this.findOne({ login: login });
};

adminSchema.statics.findByRole = function(role) {
  return this.find({ role: role });
};

adminSchema.statics.findByDepartment = function(department) {
  return this.find({ department: department });
};

adminSchema.statics.findByBitrixId = function(bitrixId) {
  return this.findOne({ bitrixId: bitrixId });
};

// Instance methods
adminSchema.methods.updateRefreshToken = function(token) {
  this.refreshToken = token;
  return this.save();
};

adminSchema.methods.clearRefreshToken = function() {
  this.refreshToken = null;
  return this.save();
};

adminSchema.methods.assignToDepartment = function(departmentId) {
  this.department = departmentId;
  return this.save();
};

adminSchema.methods.setResponsible = function(responsibleId) {
  this.responsible = responsibleId;
  return this.save();
};

// Transform output (remove password and refreshToken from JSON responses)
adminSchema.methods.toJSON = function() {
  const adminObject = this.toObject();
  delete adminObject.password;
  delete adminObject.refreshToken;
  return adminObject;
};

// Method to compare password
adminSchema.methods.comparePassword = async function(candidatePassword) {
  try {
    return await bcrypt.compare(candidatePassword, this.password);
  } catch (error) {
    throw new Error('Password comparison failed');
  }
};

// Method to get safe admin data for responses
adminSchema.methods.getSafeData = function() {
  return {
    _id: this._id,
    login: this.login,
    role: this.role,
    create_ad: this.create_ad,
    responsible: this.responsible,
    department: this.department,
    bitrixId: this.bitrixId,
    team: this.team,
    avatar: this.avatar
  };
};

// Pre-save middleware for password hashing and validation
adminSchema.pre('save', async function(next) {
  console.log('🔧 Pre-save middleware triggered for admin:', this.login);
  console.log('🔧 Modified fields:', this.modifiedPaths());
  
  // Trim login to remove extra spaces
  if (this.isModified('login')) {
    this.login = this.login.trim();
    console.log('🔧 Login trimmed:', this.login);
  }
  
  // Hash password if it's modified
  if (this.isModified('password')) {
    console.log('🔧 Password is modified, hashing...');
    console.log('🔧 Raw password length:', this.password ? this.password.length : 'null');
    try {
      const saltRounds = 10;
      const oldPassword = this.password;
      this.password = await bcrypt.hash(this.password, saltRounds);
      console.log('🔧 Password hashed successfully');
      console.log('🔧 Old password (first 10 chars):', oldPassword ? oldPassword.substring(0, 10) + '...' : 'null');
      console.log('🔧 New hash (first 20 chars):', this.password ? this.password.substring(0, 20) + '...' : 'null');
    } catch (error) {
      console.error('🔧 Password hashing failed:', error);
      return next(error);
    }
  } else {
    console.log('🔧 Password not modified, skipping hash');
  }
  
  next();
});

const Admin = mongoose.model('Admin', adminSchema, 'admins');

module.exports = Admin;
