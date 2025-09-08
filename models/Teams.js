const mongoose = require('mongoose');

const teamSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  leaderIds: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin'
  }],
  managerIds: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin'
  }],
  teamId: {
    type: mongoose.Schema.Types.ObjectId,
    default: () => new mongoose.Types.ObjectId()
  }
}, {
  timestamps: true
});

// Index for better performance
teamSchema.index({ name: 1 });
teamSchema.index({ teamId: 1 });
teamSchema.index({ leaderIds: 1 });
teamSchema.index({ managerIds: 1 });

// Virtual for getting team members count
teamSchema.virtual('totalMembers').get(function() {
  return this.leaderIds.length + this.managerIds.length;
});

// Virtual for getting leaders count
teamSchema.virtual('leadersCount').get(function() {
  return this.leaderIds.length;
});

// Virtual for getting managers count
teamSchema.virtual('managersCount').get(function() {
  return this.managerIds.length;
});

// Method to add leader
teamSchema.methods.addLeader = function(userId) {
  if (!this.leaderIds.includes(userId)) {
    this.leaderIds.push(userId);
  }
  return this;
};

// Method to remove leader
teamSchema.methods.removeLeader = function(userId) {
  this.leaderIds = this.leaderIds.filter(id => !id.equals(userId));
  return this;
};

// Method to add manager
teamSchema.methods.addManager = function(userId) {
  if (!this.managerIds.includes(userId)) {
    this.managerIds.push(userId);
  }
  return this;
};

// Method to remove manager
teamSchema.methods.removeManager = function(userId) {
  this.managerIds = this.managerIds.filter(id => !id.equals(userId));
  return this;
};

// Static method to find teams by leader
teamSchema.statics.findByLeader = function(leaderId) {
  return this.find({ leaderIds: leaderId });
};

// Static method to find teams by manager
teamSchema.statics.findByManager = function(managerId) {
  return this.find({ managerIds: managerId });
};

// Static method to find teams by user (leader or manager)
teamSchema.statics.findByUser = function(userId) {
  return this.find({
    $or: [
      { leaderIds: userId },
      { managerIds: userId }
    ]
  });
};

const Team = mongoose.model('teams', teamSchema);

module.exports = Team;