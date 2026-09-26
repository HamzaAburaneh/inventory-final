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
 * @property {Record<string, number>} [stockByStorage] - Whole balances in all three canonical locations.
 * @property {string} [stockRevision] - Last applied stock operation.
 * @property {string[]} [legacyItemIds] - Retired IDs owned by this product.
 * @property {string[]} [booths] - Optional booth tags (e.g. 'freshly', 'b1', 'jakes').
 */

/**
 * @typedef {object} Transaction
 * @property {string} id
 * @property {string} itemId
 * @property {string} itemName
 * @property {'add' | 'remove' | 'transfer' | 'merge'} type
 * @property {'countChange' | 'itemCreated' | 'itemDeleted' | 'stockTransfer' | 'itemMerged' | 'vendorMovement'} [event] - Explicit lifecycle event.
 *   Absent on legacy rows; consumers may infer it heuristically for older data.
 * @property {string} [operationId]
 * @property {string} [location]
 * @property {string} [fromLocation]
 * @property {string} [toLocation]
 * @property {number} [quantity]
 * @property {Record<string, number>} [previousStockByStorage]
 * @property {Record<string, number>} [newStockByStorage]
 * @property {string} [relatedItemId]
 * @property {'lend' | 'borrow' | 'returnIn' | 'returnOut' | 'carryOver'} [vendorAction] - vendorMovement rows only.
 * @property {string} [vendorLoanId] - vendorMovement rows only.
 * @property {string} [vendorName] - vendorMovement rows only.
 * @property {boolean} [historicalTransfer] - Annotation from persisted review, never rewrites the ledger.
 * @property {number} previousCount
 * @property {number} newCount
 * @property {Date} timestamp - Original client entry time; syncedAt is authoritative application time.
 * @property {string} user
 * @property {Date | null} [syncedAt] - Audit field: server clock when the write landed.
 *   Near timestamp for online writes; for offline writes it's the reconnect time,
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

/**
 * A product lent to or borrowed from another vendor
 * (`groups/{gid}/vendorLoans/{id}`). Counts are whole units of the product's
 * tracked unit; money is whole cents, valued at `unitPriceCents` captured when
 * the loan was recorded. What is still owed is derived (see loanBalance in
 * src/lib/vendorBalances.js), never stored.
 * @typedef {object} VendorLoan
 * @property {string} [id]
 * @property {string} vendorId - Slug of the vendor name; also `vendors/{vendorId}`
 * @property {string} vendorName
 * @property {'lent' | 'borrowed'} direction - lent: they owe us; borrowed: we owe them
 * @property {string | null} itemId - Inventory item whose stock moves, or null for a free-text product
 * @property {string} productName - Item name at the time, or the free-text product
 * @property {number | null} unitPriceCents - Agreed value per unit, if known
 * @property {number} quantity - Units originally lent or borrowed
 * @property {number} adjustedQuantity - Net corrections to what is owed
 * @property {number} returnedQuantity - Units repaid in product
 * @property {number} cashSettledQuantity - Units settled by cash
 * @property {number} cashPaidCents - Cash received or paid so far
 * @property {boolean} opening - Carried over from an old vendor-named item (2026-09 only); moved no stock
 * @property {{ itemId: string, itemName: string, count: number }} [carriedOverFrom] - Old vendor-named item this loan replaced
 * @property {string} note
 * @property {string} createdBy
 * @property {Date} [createdAt]
 * @property {Date} [updatedAt]
 * @property {'needsReview' | 'reviewed'} reviewStatus - Independent of repayment
 * @property {string | null} reviewedBy
 * @property {string} lastEntryId
 */

/**
 * One immutable event on a loan (`vendorLoans/{loanId}/entries/{id}`). The entry ID
 * is the operation ID, so a retried action finds its entry and does nothing.
 * @typedef {object} VendorLoanEntry
 * @property {string} [id]
 * @property {'loan' | 'return' | 'cash' | 'correction' | 'review'} kind
 * @property {number} quantity - Units moved, settled or corrected (signed for corrections)
 * @property {number | null} amountCents - Cash entries only
 * @property {string | null} location - Stock location for physical movements
 * @property {string | null} itemId
 * @property {string | null} stockTransactionId - Linked ledger row when stock moved
 * @property {string} note
 * @property {string} user
 * @property {Date} [timestamp]
 */
