import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { config } from 'dotenv';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, serverTimestamp, query, where, getDocs, Timestamp, writeBatch } from 'firebase/firestore';

// Get current directory for file paths
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables from project root
config({ path: join(__dirname, '../../.env') });

// Firebase configuration
const firebaseConfig = {
    apiKey: process.env.VITE_FIREBASE_API_KEY,
    authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.VITE_FIREBASE_APP_ID,
    measurementId: process.env.VITE_FIREBASE_MEASUREMENT_ID
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

/**
 * Adds a new transaction to the database.
 * @param {Object} transaction - The transaction object to add.
 * @returns {Promise<string>} A promise that resolves to the ID of the new transaction.
 */
async function addTransactionToFirestore(transaction) {
    try {
        const docRef = await addDoc(collection(db, 'transactions'), transaction);
        return docRef.id;
    } catch (error) {
        console.error('Error adding transaction: ', error);
        throw error;
    }
}

/**
 * Adds an item to the 'items' collection with default values.
 * @param {string} itemName - The name of the item to add.
 * @returns {Promise<string>} The ID of the newly added item.
 */
async function addItemToItemsCollection(itemName) {
    const itemsCollection = collection(db, 'items');
    const item = {
        name: itemName,
        barcode: '',
        count: 0,
        lowCount: 0,
        cost: 0,
        storageType: 'dry storage' // Default storage type
    };
    const docRef = await addDoc(itemsCollection, item);
    console.log(`➕ Added new item "${itemName}" to 'items' collection with ID: ${docRef.id}`);
    return docRef.id;
}

/**
 * Retrieves the item ID from the 'items' collection based on the item name.
 * If the item is not found, it adds the item to the 'items' collection and returns the new ID.
 * @param {string} itemName - The name of the item.
 * @returns {Promise<string>} The item ID.
 */
async function getItemIdByName(itemName) {
    const itemsRef = collection(db, 'items');
    const q = query(itemsRef, where('name', '==', itemName));
    const querySnapshot = await getDocs(q);

    if (!querySnapshot.empty) {
        return querySnapshot.docs[0].id;
    } else {
        // Item not found, add it to the items collection
        return await addItemToItemsCollection(itemName);
    }
}

/**
 * Deletes all existing transactions from the database
 * @returns {Promise<number>} The number of transactions deleted
 */
async function deleteAllTransactions() {
    const transactionsCollection = collection(db, 'transactions');
    const snapshot = await getDocs(transactionsCollection);

    if (snapshot.empty) {
        console.log('📭 No existing transactions found to delete');
        return 0;
    }

    console.log(`🗑️  Found ${snapshot.size} existing transactions to delete...`);

    // Use batch operations for better performance
    const batchSize = 500; // Firestore batch limit
    let deletedCount = 0;

    for (let i = 0; i < snapshot.docs.length; i += batchSize) {
        const batch = writeBatch(db);
        const batchDocs = snapshot.docs.slice(i, i + batchSize);

        batchDocs.forEach(doc => {
            batch.delete(doc.ref);
        });

        await batch.commit();
        deletedCount += batchDocs.length;
        console.log(`🗑️  Deleted ${deletedCount}/${snapshot.size} transactions...`);
    }

    console.log(`✅ Successfully deleted ${deletedCount} existing transactions`);
    return deletedCount;
}

async function addTransactions() {
    console.log('🚀 Starting to add transactions to Firebase database...\n');

    // Step 1: Delete all existing transactions
    console.log('🧹 Step 1: Clearing existing transactions...');
    const deletedCount = await deleteAllTransactions();
    console.log('');

    // Read the CSV file
    const csvFilePath = join(__dirname, 'test.csv');
    const fileContent = readFileSync(csvFilePath, 'utf-8');
    const lines = fileContent.split('\n').filter(line => line.trim() !== '' && !line.startsWith('item_name')); // Filter out header and empty lines

    let addedCount = 0;
    let errorCount = 0;
    const itemCurrentCounts = new Map(); // To store the running count of each item

    // Step 2: Read the CSV file and add new transactions
    console.log('📖 Step 2: Reading CSV file and adding new transactions...');
    for (const line of lines) {
        try {
            const [itemName, transactionType, itemCountStr, dateTime] = line.split(',');
            const trimmedItemName = itemName.trim();
            const changedAmount = parseInt(itemCountStr.trim());

            // Get previous count for the item
            const previousCount = itemCurrentCounts.get(trimmedItemName) || 0;
            let newCount;

            if (transactionType.trim().toLowerCase() === 'add') {
                newCount = previousCount + changedAmount;
            } else if (transactionType.trim().toLowerCase() === 'remove') {
                newCount = previousCount - changedAmount;
            } else {
                throw new Error(`Unknown transaction type: ${transactionType}`);
            }

            // Update the current count for the item
            itemCurrentCounts.set(trimmedItemName, newCount);

            const itemId = await getItemIdByName(trimmedItemName);

            const transaction = {
                itemId: itemId,
                itemName: trimmedItemName,
                type: transactionType.trim().toLowerCase(), // Add 'type' field as per Transaction typedef
                previousCount: previousCount,
                changedAmount: changedAmount,
                newCount: newCount,
                user: 'preloaded', // As specified by the user
                timestamp: Timestamp.fromDate(new Date(dateTime.trim())), // Parse timestamp from CSV
            };

            await addTransactionToFirestore(transaction);
            console.log(`✅ Added transaction for "${trimmedItemName}" (ID: ${itemId || 'Not Found'})`);
            addedCount++;
            await new Promise(resolve => setTimeout(resolve, 50)); // Small delay
        } catch (error) {
            console.error(`❌ Error processing line: "${line}". Error: ${error.message}`);
            errorCount++;
        }
    }

    console.log('\n📊 Final Summary:');
    console.log(`🗑️  Transactions deleted: ${deletedCount}`);
    console.log(`✅ Transactions added: ${addedCount}`);
    console.log(`❌ Transactions with errors: ${errorCount}`);
    console.log(`📝 Total lines processed: ${lines.length}`);
}

addTransactions()
    .then(() => {
        console.log('\n🎉 Script completed successfully!');
        process.exit(0);
    })
    .catch((error) => {
        console.error('\n💥 Script failed:', error);
        process.exit(1);
    });