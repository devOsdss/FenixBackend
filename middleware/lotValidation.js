/**
 * LOT Validation Middleware
 * 
 * Provides reusable validation middleware for LOT operations.
 * Implements input sanitization and validation best practices.
 * 
 * @module middleware/lotValidation
 * @author Senior Developer (5+ years experience)
 */

const mongoose = require('mongoose');

/**
 * Validation helper functions
 */
const validators = {
  /**
   * Check if string is not empty after trimming
   */
  isNonEmptyString: (value) => {
    return typeof value === 'string' && value.trim().length > 0;
  },

  /**
   * Check if value is a valid positive number
   */
  isPositiveNumber: (value) => {
    const num = parseFloat(value);
    return !isNaN(num) && num >= 0 && Number.isFinite(num);
  },

  /**
   * Check if value is a valid date
   */
  isValidDate: (value) => {
    const date = new Date(value);
    return date instanceof Date && !isNaN(date.getTime());
  },

  /**
   * Check if date is not in future
   */
  isNotFutureDate: (value) => {
    const date = new Date(value);
    return date <= new Date();
  },

  /**
   * Check if value is valid MongoDB ObjectId
   */
  isValidObjectId: (value) => {
    return mongoose.Types.ObjectId.isValid(value);
  }
};

/**
 * Middleware: Validate LOT creation data
 */
const validateCreateLot = (req, res, next) => {
  const { leadId, lotName, amount, lotDate } = req.body;
  const errors = {};

  // Validate leadId
  if (!leadId) {
    errors.leadId = 'ID лида обязателен';
  } else if (!validators.isValidObjectId(leadId)) {
    errors.leadId = 'Некорректный формат ID лида';
  }

  // Validate lotName
  if (!lotName) {
    errors.lotName = 'Название лота обязательно';
  } else if (!validators.isNonEmptyString(lotName)) {
    errors.lotName = 'Название лота не может быть пустым';
  } else if (lotName.trim().length < 3) {
    errors.lotName = 'Название лота должно содержать минимум 3 символа';
  } else if (lotName.trim().length > 200) {
    errors.lotName = 'Название лота не может превышать 200 символов';
  }

  // Validate amount
  if (amount === undefined || amount === null || amount === '') {
    errors.amount = 'Сумма обязательна';
  } else if (!validators.isPositiveNumber(amount)) {
    errors.amount = 'Сумма должна быть положительным числом';
  }

  // Validate lotDate
  if (!lotDate) {
    errors.lotDate = 'Дата обязательна';
  } else if (!validators.isValidDate(lotDate)) {
    errors.lotDate = 'Некорректный формат даты';
  } else if (!validators.isNotFutureDate(lotDate)) {
    errors.lotDate = 'Дата не может быть в будущем';
  }

  // If there are validation errors, return 400
  if (Object.keys(errors).length > 0) {
    return res.status(400).json({
      success: false,
      message: 'Ошибка валидации данных',
      errors
    });
  }

  // Sanitize inputs
  req.body.lotName = lotName.trim();
  req.body.amount = parseFloat(amount);
  req.body.lotDate = new Date(lotDate);

  next();
};

/**
 * Middleware: Validate LOT amount update data
 */
const validateUpdateAmount = (req, res, next) => {
  const { amount, reason } = req.body;
  const errors = {};

  // Validate amount
  if (amount === undefined || amount === null || amount === '') {
    errors.amount = 'Сумма обязательна';
  } else if (!validators.isPositiveNumber(amount)) {
    errors.amount = 'Сумма должна быть положительным числом';
  }

  // Validate reason (optional but if provided, must be valid)
  if (reason !== undefined && reason !== null) {
    if (typeof reason !== 'string') {
      errors.reason = 'Причина должна быть строкой';
    } else if (reason.length > 500) {
      errors.reason = 'Причина не может превышать 500 символов';
    }
  }

  // If there are validation errors, return 400
  if (Object.keys(errors).length > 0) {
    return res.status(400).json({
      success: false,
      message: 'Ошибка валидации данных',
      errors
    });
  }

  // Sanitize inputs
  req.body.amount = parseFloat(amount);
  if (reason) {
    req.body.reason = reason.trim();
  }

  next();
};

/**
 * Middleware: Validate ObjectId parameter
 */
const validateObjectIdParam = (paramName = 'id') => {
  return (req, res, next) => {
    const id = req.params[paramName];

    if (!id) {
      return res.status(400).json({
        success: false,
        message: `Параметр ${paramName} обязателен`
      });
    }

    if (!validators.isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: `Некорректный формат ${paramName}`
      });
    }

    next();
  };
};

/**
 * Middleware: Validate pagination query parameters
 */
const validatePagination = (req, res, next) => {
  const { page, limit } = req.query;

  // Validate page
  if (page !== undefined) {
    const pageNum = parseInt(page);
    if (isNaN(pageNum) || pageNum < 1) {
      return res.status(400).json({
        success: false,
        message: 'Параметр page должен быть положительным числом'
      });
    }
    req.query.page = pageNum;
  }

  // Validate limit
  if (limit !== undefined) {
    const limitNum = parseInt(limit);
    if (isNaN(limitNum) || limitNum < 1 || limitNum > 100) {
      return res.status(400).json({
        success: false,
        message: 'Параметр limit должен быть числом от 1 до 100'
      });
    }
    req.query.limit = limitNum;
  }

  next();
};

/**
 * Middleware: Validate date range query parameters
 */
const validateDateRange = (req, res, next) => {
  const { startDate, endDate } = req.query;

  // Validate startDate
  if (startDate !== undefined) {
    if (!validators.isValidDate(startDate)) {
      return res.status(400).json({
        success: false,
        message: 'Некорректный формат startDate'
      });
    }
  }

  // Validate endDate
  if (endDate !== undefined) {
    if (!validators.isValidDate(endDate)) {
      return res.status(400).json({
        success: false,
        message: 'Некорректный формат endDate'
      });
    }
  }

  // Validate that startDate is before endDate
  if (startDate && endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (start > end) {
      return res.status(400).json({
        success: false,
        message: 'startDate не может быть позже endDate'
      });
    }
  }

  next();
};

/**
 * Middleware: Sanitize search query
 */
const sanitizeSearch = (req, res, next) => {
  if (req.query.search) {
    // Remove special regex characters to prevent injection
    req.query.search = req.query.search
      .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      .trim();

    // Limit search length
    if (req.query.search.length > 100) {
      req.query.search = req.query.search.substring(0, 100);
    }
  }

  next();
};

module.exports = {
  validateCreateLot,
  validateUpdateAmount,
  validateObjectIdParam,
  validatePagination,
  validateDateRange,
  sanitizeSearch,
  validators
};
