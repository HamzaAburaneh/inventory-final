# Inventory Scripts

This directory contains scripts for managing inventory items.

## Reconcile Stock Item Script

`reconcile-stock-item.js` repairs one item whose `stockByStorage` balances no
longer add up to its `count`. The app shows such an item as **Check stock** and
refuses further stock changes on it. The usual cause is an older deployed build
(without storage locations) changing `count` while the map stays put.

The repair keeps `count` and moves the difference into one location: the item's
starting location by default, or `--location Freezer|Refrigerator|"Dry Storage"`.
No ledger row is written because the total does not change. It stamps a fresh
`stockRevision` so any pending actions re-check their base.

Credentials are the same as the backfill script below (`BACKFILL_EMAIL` /
`BACKFILL_PASSWORD` in the project-root `.env`, or a service-account key).

```bash
cd src/scripts
npm install                                                # first time only
node reconcile-stock-item.js --audit                       # READ ONLY - list every broken item
node reconcile-stock-item.js --item "test item"            # DRY RUN - prints the plan
node reconcile-stock-item.js --item "test item" --apply    # write the repaired map
```

| Flag                | Effect                                                               |
| ------------------- | -------------------------------------------------------------------- |
| `--audit`           | Read-only scan; prints each item the app shows as "Check stock".     |
| `--item <name\|id>` | Which item to repair. A name must match exactly one item.            |
| `--location <loc>`  | Location that absorbs the difference (default: starting).            |
| `--all-in`          | Put the whole `count` in `--location` and zero the others.           |
| `--group <id>`      | Restrict the search to one group.                                    |
| `--apply`           | Write. Without it the script only reports.                           |
| `--key <path>`      | Service-account JSON, if `GOOGLE_APPLICATION_CREDENTIALS` isn't set. |

## Backfill Transaction Events Script

`backfill-transaction-events.js` writes `event: 'countChange'` onto ledger rows
that have no `event` field at all. Those are transactions written before
lifecycle events existed; the app already reads them as `event ?? 'countChange'`,
so nothing is broken today — but that default lives only in JavaScript, and
**Firestore can only filter on values that are actually stored**.

This matters because the transaction history page applies its type filters
server-side: "Stock added" is the query `event == 'countChange' && type == 'add'`,
bounded to one page of results instead of downloading the whole ledger. Rows
missing `event` never match that query, so they would silently disappear from
every filtered view until they are tagged.

The script changes no counts and rewrites no history — it only fills in a blank.
Rows that already carry an `event` (including `itemCreated` / `itemDeleted`) are
left untouched, which also makes it safe to re-run.

### Credentials

Pick either. Both read the `VITE_FIREBASE_*` config from the project-root `.env`.

**Sign-in (easiest — nothing to download).** The rules let any group member write
that group's transactions, so an ordinary app login is enough. Add to the
project-root `.env`:

```
BACKFILL_EMAIL=you@example.com
BACKFILL_PASSWORD=your_password
```

This covers the one group that account belongs to.

**Service account (Admin SDK).** Bypasses the rules and can do every group at
once. Firebase console -> Project settings -> Service accounts -> Generate new
private key, then set `GOOGLE_APPLICATION_CREDENTIALS` or pass `--key`.

### Running it

```bash
cd src/scripts
npm install                                    # first time only
node backfill-transaction-events.js            # DRY RUN - reports, writes nothing
node backfill-transaction-events.js --apply    # actually write
```

| Flag           | Effect                                                               |
| -------------- | -------------------------------------------------------------------- |
| _(none)_       | Dry run: prints how many rows would change, with examples.           |
| `--apply`      | Commit the writes, in batches of 500.                                |
| `--group <id>` | Restrict to one group.                                               |
| `--key <path>` | Service-account JSON, if `GOOGLE_APPLICATION_CREDENTIALS` isn't set. |

**Run the dry run first.** `--apply` is a real write across every untagged row
(thousands, on an established group), so it costs writes and should be a
deliberate, one-time action.

### Deploy the indexes too

The server-side filters need the composite indexes in `firestore.indexes.json`:

```bash
firebase deploy --only firestore:indexes
```

Until those are live, filtered queries fail with `failed-precondition` and the
page falls back to loading the full ledger and filtering in JS — correct, just
slow, and the header shows "index pending". Firestore serves a query and its
exact reverse from one index, so the descending-`timestamp` entries also cover
the oldest-first view.

## Audit Timestamps Script

`audit-timestamps.js` scans the `transactions` collection for clock anomalies —
entries whose device `timestamp` is implausible against the trusted server
`syncedAt` clock (a change recorded in the "future" relative to when it synced,
or one recorded suspiciously long before it synced). It only reads; it never
writes. The detection rules live in `src/lib/transactionAudit.js`.

```bash
cd src/scripts
npm install            # first time only
npm run audit-timestamps
```

Because the Firestore rules require an authenticated user, add these to the
project-root `.env` (alongside the `VITE_FIREBASE_*` config):

```
AUDIT_EMAIL=you@example.com
AUDIT_PASSWORD=your_password
# optional — days-before-sync gap that counts as "stale" (default 2):
AUDIT_STALE_DAYS=2
```

## Add Unique Items Script

The `add-unique-items.js` script reads items from `unique-items.txt` and adds them to your Firebase database with appropriate storage types based on the rules defined in `storage-rules.js`.

### Prerequisites

1. Make sure you have Node.js installed
2. Set up your Firebase environment variables in a `.env` file in the project root:
   ```
   VITE_FIREBASE_API_KEY=your_api_key
   VITE_FIREBASE_AUTH_DOMAIN=your_auth_domain
   VITE_FIREBASE_PROJECT_ID=your_project_id
   VITE_FIREBASE_STORAGE_BUCKET=your_storage_bucket
   VITE_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
   VITE_FIREBASE_APP_ID=your_app_id
   VITE_FIREBASE_MEASUREMENT_ID=your_measurement_id
   ```

### Installation

1. Navigate to the scripts directory:

   ```bash
   cd src/scripts
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

### Usage

Run the script to add all unique items to your Firebase database:

```bash
npm run add-items
```

Or run directly with Node:

```bash
node add-unique-items.js
```

### What the script does

1. **Deletes all existing items** from the Firebase database (complete refresh)
2. **Reads unique items** from `unique-items.txt`
3. **Determines storage type** for each item using rules from `storage-rules.js`
4. **Creates item records** with the following fields:
   - `name`: Item name from the text file
   - `barcode`: Empty string (as requested)
   - `count`: 0 (as requested)
   - `lowCount`: 0 (as requested - this is the "LOW ITEM" field)
   - `cost`: 0 (as requested)
   - `storageType`: Determined from storage rules (freezer, refrigerator, or dry storage)

### Output

The script provides detailed console output showing:

- 🗑️ Items deleted from database
- ✅ Successfully added items
- ❌ Items that failed to add (with error details)
- 📊 Final summary with counts

**⚠️ Warning**: This script will delete ALL existing items in your database before adding the new ones. Make sure you have a backup if needed.

### Storage Type Assignment

Items are assigned storage types based on the rules in `storage-rules.js`:

- **Freezer**: Meat, frozen items, etc.
- **Refrigerator**: Dairy, fresh produce, sauces, etc.
- **Dry Storage**: Non-perishables, utensils, cleaning supplies, etc.

If an item doesn't match any rule, it defaults to "dry storage".

### Error Handling

- The script checks for existing items to prevent duplicates
- Individual item failures won't stop the entire process
- Detailed error messages help identify issues
- Small delays between additions prevent database overload
