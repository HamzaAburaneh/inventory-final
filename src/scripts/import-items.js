import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, query, where, addDoc, updateDoc, doc, serverTimestamp, deleteDoc, writeBatch } from 'firebase/firestore';
import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse/sync';
import dotenv from 'dotenv';
import { storageRules } from './storage-rules.js';

// Load environment variables
dotenv.config();

// Initialize Firebase with environment variables
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

// Path to the CSV file
const csvFilePath = path.resolve('../../ocr-processing/CNE_transactions_2024.csv');

/**
 * Delete all documents in a collection
 * @param {string} collectionName - The name of the collection to clear
 * @returns {Promise<number>} - Number of documents deleted
 */
async function clearCollection(collectionName) {
  try {
    console.log(`Clearing ${collectionName} collection...`);
    const collectionRef = collection(db, collectionName);
    const snapshot = await getDocs(collectionRef);
    
    if (snapshot.empty) {
      console.log(`No documents found in ${collectionName} collection.`);
      return 0;
    }
    
    // Use batched writes for better performance
    const batchSize = 500; // Firestore limit is 500 operations per batch
    let count = 0;
    const totalCount = snapshot.size;
    
    // Process in batches
    const batches = [];
    let currentBatch = writeBatch(db);
    let operationCount = 0;
    
    snapshot.forEach(doc => {
      currentBatch.delete(doc.ref);
      operationCount++;
      count++;
      
      // If we reach batch limit, commit and create a new batch
      if (operationCount >= batchSize) {
        batches.push(currentBatch.commit());
        currentBatch = writeBatch(db);
        operationCount = 0;
      }
    });
    
    // Commit any remaining operations
    if (operationCount > 0) {
      batches.push(currentBatch.commit());
    }
    
    // Wait for all batches to complete
    await Promise.all(batches);
    
    console.log(`Successfully deleted ${count} documents from ${collectionName} collection.`);
    return count;
  } catch (error) {
    console.error(`Error clearing ${collectionName} collection:`, error);
    throw error;
  }
}

/**
 * Main function to import items and transactions from CSV
 */
async function importItemsFromCSV() {
  try {
    // First, clear existing data
    await clearCollection('items');
    await clearCollection('transactions');
    console.log('Existing data cleared. Starting import...');
    
    // Read and parse the CSV file
    const fileContent = fs.readFileSync(csvFilePath, 'utf8');
    const records = parse(fileContent, {
      columns: true,
      skip_empty_lines: true
    });

    console.log(`Found ${records.length} records in CSV file`);

    // Keep track of item counts to calculate previous and new counts for transactions
    const itemCounts = {};
    
    // Process each record
    for (const record of records) {
      const { item_name, transaction_type, item_count, date_time } = record;
      
      // Skip if any required field is missing
      if (!item_name || !transaction_type || !item_count || !date_time) {
        console.warn('Skipping record with missing data:', record);
        continue;
      }

      // Convert item_count to number
      const count = parseInt(item_count, 10);
      if (isNaN(count)) {
        console.warn('Skipping record with invalid count:', record);
        continue;
      }

      // Find or create the item
      let itemId = await findOrCreateItem(item_name);
      
      // Initialize item count if not already tracked
      if (!(itemId in itemCounts)) {
        // Get current count from database
        const currentCount = await getCurrentItemCount(itemId);
        itemCounts[itemId] = currentCount;
      }

      // Calculate previous and new counts
      const previousCount = itemCounts[itemId];
      const newCount = transaction_type === 'add' 
        ? previousCount + count 
        : Math.max(0, previousCount - count);
      
      // Update the tracking count
      itemCounts[itemId] = newCount;
      
      // Create the transaction
      await createTransaction({
        itemId,
        itemName: item_name,
        type: transaction_type,
        previousCount,
        newCount,
        timestamp: new Date(date_time),
        user: 'CSV Import'
      });

      // Update the item count in the database
      await updateItemCount(itemId, newCount);
    }

    console.log('Import completed successfully');
  } catch (error) {
    console.error('Error importing items:', error);
  }
}

/**
 * Find an item by name or create it if it doesn't exist
 * @param {string} itemName - The name of the item
 * @returns {Promise<string>} - The item ID
 */
async function findOrCreateItem(itemName) {
  try {
    // Check if item already exists
    const itemsRef = collection(db, 'items');
    const q = query(itemsRef, where('name', '==', itemName));
    const querySnapshot = await getDocs(q);
    
    // If item exists, return its ID
    if (!querySnapshot.empty) {
      return querySnapshot.docs[0].id;
    }
    
    // Determine storage type based on rules
    let storageType = '';
    const lowerCaseItemName = itemName.toLowerCase();

    for (const type in storageRules) {
      if (storageRules[type].some(keyword => lowerCaseItemName.includes(keyword.toLowerCase()))) {
        storageType = type;
        break;
      }
    }

    // Otherwise, create a new item
    const newItem = {
      name: itemName,
      barcode: '', // Empty barcode as it's not provided
      count: 0,    // Start with 0, will be updated by transactions
      lowCount: null,
      cost: null,
      storageType: storageType // Determined storage type
    };
    
    const docRef = await addDoc(itemsRef, newItem);
    console.log(`Created new item: ${itemName} with ID: ${docRef.id}`);
    return docRef.id;
  } catch (error) {
    console.error(`Error finding or creating item ${itemName}:`, error);
    throw error;
  }
}

/**
 * Get the current count of an item
 * @param {string} itemId - The ID of the item
 * @returns {Promise<number>} - The current count
 */
async function getCurrentItemCount(itemId) {
  try {
    const itemsRef = collection(db, 'items');
    const q = query(itemsRef);
    const querySnapshot = await getDocs(q);
    
    const item = querySnapshot.docs.find(doc => doc.id === itemId);
    return item ? (item.data().count || 0) : 0;
  } catch (error) {
    console.error(`Error getting current count for item ${itemId}:`, error);
    return 0;
  }
}

/**
 * Update the count of an item
 * @param {string} itemId - The ID of the item
 * @param {number} newCount - The new count
 */
async function updateItemCount(itemId, newCount) {
  try {
    const itemRef = doc(db, 'items', itemId);
    await updateDoc(itemRef, { count: newCount });
  } catch (error) {
    console.error(`Error updating count for item ${itemId}:`, error);
    throw error;
  }
}

/**
 * Create a transaction
 * @param {Object} transaction - The transaction data
 */
async function createTransaction(transaction) {
  try {
    const transactionsRef = collection(db, 'transactions');
    await addDoc(transactionsRef, {
      ...transaction,
      timestamp: serverTimestamp() // Use serverTimestamp for consistency
    });
  } catch (error) {
    console.error('Error creating transaction:', error);
    throw error;
  }
}

// Run the import
importItemsFromCSV()
  .then(() => {
    console.log('Import script completed');
    process.exit(0);
  })
  .catch(error => {
    console.error('Import script failed:', error);
    process.exit(1);
  });
