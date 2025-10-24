const mongoose = require('mongoose');

const successfulLeadSchema = new mongoose.Schema({
  // Данные из модалки закрытия
  amount: {
    type: Number,
    required: [true, 'Сумма обязательна'],
    min: [0, 'Сумма не может быть отрицательной']
  },
  
  closeDate: {
    type: Date,
    required: [true, 'Дата закрытия обязательна']
  },
  
  transferDate: {
    type: Date,
    required: [true, 'Дата передачи обязательна']
  },
  
  // Дополнительные поля
  assigned: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin',
    required: [true, 'Ответственный обязателен']
  },
  
  team: {
    type: String,
    default: null
  },
  
  // Ссылка на оригинальный лид
  leadId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Leads',
    required: [true, 'ID лида обязателен']
  },
  
  // Информация о лиде (для быстрого доступа без populate)
  leadName: {
    type: String,
    required: true
  }
}, {
  timestamps: true // Автоматически добавляет createdAt и updatedAt
});

// Индексы для быстрого поиска
successfulLeadSchema.index({ leadId: 1 });
successfulLeadSchema.index({ assigned: 1 });
successfulLeadSchema.index({ team: 1 });
successfulLeadSchema.index({ closeDate: 1 });
successfulLeadSchema.index({ createdAt: -1 });

// Виртуальное поле для расчета конверсии
successfulLeadSchema.virtual('conversionTime').get(function() {
  if (this.transferDate && this.closeDate) {
    const diff = this.closeDate - this.transferDate;
    return Math.ceil(diff / (1000 * 60 * 60 * 24)); // Дни
  }
  return null;
});

// Статические методы
successfulLeadSchema.statics.getByManager = function(managerId) {
  return this.find({ assigned: managerId })
    .populate('leadId', 'name phone email')
    .populate('assigned', 'login')
    .sort({ closeDate: -1 });
};

successfulLeadSchema.statics.getByTeam = function(teamName) {
  return this.find({ team: teamName })
    .populate('leadId', 'name phone email')
    .populate('assigned', 'login')
    .sort({ closeDate: -1 });
};

successfulLeadSchema.statics.getStatsByPeriod = function(startDate, endDate) {
  return this.aggregate([
    {
      $match: {
        closeDate: {
          $gte: new Date(startDate),
          $lte: new Date(endDate)
        }
      }
    },
    {
      $group: {
        _id: null,
        totalAmount: { $sum: '$amount' },
        totalLeads: { $sum: 1 },
        avgAmount: { $avg: '$amount' }
      }
    }
  ]);
};

successfulLeadSchema.statics.getStatsByManager = function(startDate, endDate) {
  return this.aggregate([
    {
      $match: {
        closeDate: {
          $gte: new Date(startDate),
          $lte: new Date(endDate)
        }
      }
    },
    {
      $group: {
        _id: '$assigned',
        totalAmount: { $sum: '$amount' },
        totalLeads: { $sum: 1 },
        avgAmount: { $avg: '$amount' }
      }
    },
    {
      $sort: { totalAmount: -1 }
    }
  ]);
};

// Методы экземпляра
successfulLeadSchema.methods.getConversionDays = function() {
  if (this.transferDate && this.closeDate) {
    const diff = this.closeDate - this.transferDate;
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  }
  return null;
};

const SuccessfulLead = mongoose.model('SuccessfulLead', successfulLeadSchema);

module.exports = SuccessfulLead;