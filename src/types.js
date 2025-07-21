/**
 * @typedef {object} Item
 * @property {string} id
 * @property {string} name
 * @property {string} barcode
 * @property {number} count
 * @property {number | null} lowCount
 * @property {number | null} cost
 * @property {'' | 'freezer' | 'refrigerator' | 'dry storage'} storageType
 */

/**
 * @typedef {object} Transaction
 * @property {string} id
 * @property {string} itemId
 * @property {string} itemName
 * @property {'add' | 'remove'} type
 * @property {number} previousCount
 * @property {number} newCount
 * @property {Date} timestamp
 * @property {string} user
 */

/**
 * @typedef {object} DailyAnalysis
 * @property {string} date - ISO date string (YYYY-MM-DD)
 * @property {number} totalAdded
 * @property {number} totalRemoved
 * @property {number} netChange
 * @property {number} transactionCount
 * @property {Object.<string, ItemDailyStats>} itemStats
 */

/**
 * @typedef {object} ItemDailyStats
 * @property {string} itemId
 * @property {string} itemName
 * @property {number} added
 * @property {number} removed
 * @property {number} netChange
 * @property {number} transactionCount
 */

/**
 * @typedef {object} HourlyActivity
 * @property {number} hour - 0-23
 * @property {number} transactionCount
 * @property {number} totalChange
 */

/**
 * @typedef {object} TopMover
 * @property {string} itemId
 * @property {string} itemName
 * @property {number} totalTransactions
 * @property {number} totalAdded
 * @property {number} totalRemoved
 * @property {number} netChange
 * @property {number} volatility - Standard deviation of daily changes
 */
