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
