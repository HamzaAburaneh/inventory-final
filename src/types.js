/**
 * @typedef {object} Item
 * @property {string} id
 * @property {string} name
 * @property {string} barcode
 * @property {number} count
 * @property {number | null} lowCount
 * @property {number | null} cost
 * @property {'' | 'Freezer' | 'Refrigerator' | 'Dry Storage'} storageType -
 *   Stored title-cased as written by the add/edit forms. Some legacy rows hold
 *   lowercase values; display/styling helpers in tableUtils.js are
 *   case-insensitive, so both render correctly.
 * @property {string[]} [booths] - Optional booth tags (e.g. 'freshly', 'b1', 'jakes').
 */

/**
 * @typedef {object} Transaction
 * @property {string} id
 * @property {string} itemId
 * @property {string} itemName
 * @property {'add' | 'remove'} type
 * @property {'countChange' | 'itemCreated' | 'itemDeleted'} [event] - Explicit lifecycle event.
 *   Absent on legacy rows; consumers may infer it heuristically for older data.
 * @property {number} previousCount
 * @property {number} newCount
 * @property {Date} timestamp - When the change happened (device clock offline, server clock online).
 * @property {string} user
 * @property {Date | null} [syncedAt] - Audit field: server clock when the write landed.
 *   Equals timestamp for online writes; for offline writes it's the reconnect time,
 *   so a far gap from timestamp flags a wrong device clock. Null until synced / on legacy rows.
 */

/**
 * A workspace that owns an isolated inventory. Every item and transaction lives
 * under `groups/{id}/…`; users join via `inviteCode`.
 * @typedef {object} Group
 * @property {string} name
 * @property {string} ownerId - uid of the creator/owner
 * @property {string} [inviteCode] - Current active invite code for the group
 * @property {Date} [createdAt]
 */

/**
 * A user's membership row within a group (`groups/{gid}/members/{uid}`).
 * @typedef {object} GroupMember
 * @property {'owner' | 'member'} role
 * @property {string} displayName - Captured at join for member-list display
 * @property {string} email - Captured at join for member-list display
 * @property {string} [inviteCode] - Code used to join (members only)
 * @property {Date} [joinedAt]
 */

/**
 * A booth (physical stand/location) items can be tagged with, scoped to a
 * group (`groups/{gid}/booths/{id}`). The doc id is a slug derived from the
 * label at creation and never changes, since `Item.booths` arrays reference
 * it directly — renaming only updates `label`.
 * @typedef {object} Booth
 * @property {string} label - Display name (editable)
 * @property {string} color - Hex color for the booth's chip/tag
 * @property {Date} [createdAt]
 */

/**
 * One item's line on a saved order draft. Only the fields the user actually
 * changed are stored — an absent `qty` means "still the suggested quantity",
 * which lets a reopened draft track a refreshed forecast instead of freezing
 * yesterday's numbers.
 * @typedef {object} OrderLine
 * @property {number} [qty] - User-entered case count overriding the suggestion
 * @property {boolean} [included] - User's include/exclude choice for this item
 */

/**
 * A shared, per-day order draft (`groups/{gid}/orders/{dayKey}`), so an order
 * edited on one device is visible to the rest of the group (e.g. an owner
 * reviewing what staff plan to buy). Keyed by the order's day, not the
 * delivery day.
 * @typedef {object} OrderDraft
 * @property {Object.<string, OrderLine>} lines - Per-item edits, keyed by item id
 * @property {number} coverageDays - Days of demand the quantities were sized for
 * @property {number} leadDays - Delivery lead the quantities were sized for
 * @property {Date | null} updatedAt - Server clock of the last save
 * @property {string} updatedBy - Display name/email of whoever last saved
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

/**
 * A contiguous CNE fair run derived from the transaction ledger by gap
 * segmentation (see cneCalendar.js). Off-season days between runs are excluded.
 * @typedef {object} FairRun
 * @property {Date} start - First active day of the run (local midnight)
 * @property {Date} end - Last active day of the run (local midnight)
 * @property {number} totalDays - Inclusive day span of the run
 */

/**
 * Data-grounded forecast confidence: a level plus the plain-English basis it
 * rests on, instead of a fabricated percent.
 * @typedef {object} Confidence
 * @property {number} score - 0..1 blended score
 * @property {'high' | 'medium' | 'low'} level
 * @property {string} basis - What the confidence is based on, in words
 */

/**
 * A day an order-planning walk lands on within the forecast horizon.
 * @typedef {object} PlanDay
 * @property {string} date - ISO day key (YYYY-MM-DD)
 * @property {number} dayIndex - 0-based offset into the forecast horizon
 * @property {boolean} [immediate] - Reorder-by only: already at/below threshold
 */

/**
 * One item's forecast as returned by the stockPredictions API. `prediction` is
 * the per-day case demand over `forecastDates`; both the deterministic and AI
 * paths return this shape.
 * @typedef {object} PredictionResult
 * @property {number[]} prediction - Per-day predicted demand (cases)
 * @property {string} reasoning - Short human explanation of the drivers
 * @property {Confidence} confidence
 * @property {string[]} factors - Key factor tags
 * @property {string} method - e.g. 'AI Enhanced', 'ARIMA', 'CNE Baseline', 'No Data'
 * @property {string | null} model - OpenRouter model slug when AI produced it, else null
 * @property {number[]} baseline - Deterministic CNE baseline, for comparison
 * @property {string} baselineSource - 'cross-year+calendar' | 'cross-year' | 'calendar' | 'none'
 * @property {number[] | null} arima - ARIMA reference for the horizon, if computed
 * @property {string[]} forecastDates - ISO day keys aligned with `prediction`
 * @property {PlanDay | null} stockOut - Predicted run-out day within the horizon
 * @property {PlanDay | null} reorderBy - Day to place the next order
 */
