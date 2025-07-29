# Inventory Scripts

This directory contains scripts for managing inventory items.

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