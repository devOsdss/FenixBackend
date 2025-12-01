/**
 * Professional logging utility
 * Provides structured logging with different levels and contexts
 * @module utils/logger
 */

const LOG_LEVELS = {
  ERROR: 'ERROR',
  WARN: 'WARN',
  INFO: 'INFO',
  DEBUG: 'DEBUG'
};

const isDevelopment = process.env.NODE_ENV !== 'production';
const isDebugEnabled = process.env.DEBUG === 'true' || isDevelopment;

/**
 * Format log message with timestamp and context
 */
function formatMessage(level, context, message, data) {
  const timestamp = new Date().toISOString();
  const prefix = `[${timestamp}] [${level}] [${context}]`;
  
  if (data) {
    return `${prefix} ${message} ${JSON.stringify(data)}`;
  }
  return `${prefix} ${message}`;
}

/**
 * Logger class with context support
 */
class Logger {
  constructor(context = 'App') {
    this.context = context;
  }

  error(message, data) {
    console.error(formatMessage(LOG_LEVELS.ERROR, this.context, message, data));
  }

  warn(message, data) {
    console.warn(formatMessage(LOG_LEVELS.WARN, this.context, message, data));
  }

  info(message, data) {
    console.info(formatMessage(LOG_LEVELS.INFO, this.context, message, data));
  }

  debug(message, data) {
    if (isDebugEnabled) {
      console.log(formatMessage(LOG_LEVELS.DEBUG, this.context, message, data));
    }
  }

  /**
   * Create child logger with extended context
   */
  child(childContext) {
    return new Logger(`${this.context}:${childContext}`);
  }
}

/**
 * Create logger instance with context
 */
function createLogger(context) {
  return new Logger(context);
}

module.exports = {
  createLogger,
  Logger
};
