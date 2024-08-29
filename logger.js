const { LOG_LEVEL } = require('./config');

/**
 * Creates a timestamp string for the current date and time
 * @returns {string} Formatted timestamp string
 */
function getCurrentDateString() {
    return (new Date()).toISOString() + ' ::';
}

/**
 * Logger object with methods for different log levels
 */
const logger = {
    /**
     * Log an error message
     * Always displayed regardless of LOG_LEVEL
     * @param {...any} args - The message and any additional arguments to log
     */
    error: (...args) => console.error(getCurrentDateString(), ...args),

    /**
     * Log a warning message
     * Displayed for LOG_LEVEL of 'warn', 'info', or 'debug'
     * @param {...any} args - The message and any additional arguments to log
     */
    warn: (...args) => {
        if (['warn', 'info', 'debug'].includes(LOG_LEVEL)) console.warn(getCurrentDateString(), ...args);
    },

    /**
     * Log an info message
     * Displayed for LOG_LEVEL of 'info' or 'debug'
     * @param {...any} args - The message and any additional arguments to log
     */
    info: (...args) => {
        if (['info', 'debug'].includes(LOG_LEVEL)) console.log(getCurrentDateString(), ...args);
    },

    /**
     * Log a debug message
     * Only displayed for LOG_LEVEL of 'debug'
     * @param {...any} args - The message and any additional arguments to log
     */
    debug: (...args) => {
        if (LOG_LEVEL === 'debug') console.log(getCurrentDateString(), ...args);
    }
};

module.exports = logger;