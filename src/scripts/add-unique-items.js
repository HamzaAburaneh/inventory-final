import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { config } from 'dotenv';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, query, where, getDocs, deleteDoc, writeBatch } from 'firebase/firestore';
import { storageRules } from './storage-rules.js';

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
 * Determines the storage type for an item based on storage rules
 * @param {string} itemName - The name of the item
 * @returns {string} The storage type ('freezer', 'refrigerator', or 'dry storage')
 */
function getStorageType(itemName) {
    const lowerItemName = itemName.toLowerCase().trim();
    
    // Check each storage type for matching items
    for (const [storageType, items] of Object.entries(storageRules)) {
        if (items.some(item => item.toLowerCase() === lowerItemName)) {
            return storageType;
        }
    }
    
    // Default to dry storage if no match found
    return 'dry storage';
}

/**
 * Deletes all existing items from the database
 * @returns {Promise<number>} The number of items deleted
 */
async function deleteAllItems() {
    const itemsCollection = collection(db, 'items');
    const snapshot = await getDocs(itemsCollection);
    
    if (snapshot.empty) {
        console.log('📭 No existing items found to delete');
        return 0;
    }
    
    console.log(`🗑️  Found ${snapshot.size} existing items to delete...`);
    
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
        console.log(`🗑️  Deleted ${deletedCount}/${snapshot.size} items...`);
    }
    
    console.log(`✅ Successfully deleted ${deletedCount} existing items`);
    return deletedCount;
}

/**
 * Adds an item to the Firebase database
 * @param {Object} item - The item object to add
 * @returns {Promise<string>} The ID of the added item
 */
async function addItemToDatabase(item) {
    const itemsCollection = collection(db, 'items');
    const docRef = await addDoc(itemsCollection, item);
    return docRef.id;
}

/**
 * Main function to process and add unique items to the database
 */
async function addUniqueItems() {
    try {
        // Step 1: Delete all existing items
        console.log('🧹 Step 1: Clearing existing items...');
        const deletedCount = await deleteAllItems();
        console.log('');
        
        // Step 2: Read the unique items file
        console.log('📖 Step 2: Reading unique items file...');
        const uniqueItemsPath = join(__dirname, 'unique-items.txt');
        const fileContent = readFileSync(uniqueItemsPath, 'utf-8');
        
        // Parse items from file (each line is an item)
        const items = fileContent
            .split('\n')
            .map(line => line.trim())
            .filter(line => line && !line.startsWith('#') && line !== 'storageRules'); // Filter out empty lines, comments, and the storageRules entry
        
        console.log(`📦 Found ${items.length} unique items to process\n`);
        
        // Step 3: Add new items
        console.log('➕ Step 3: Adding new items...');
        let addedCount = 0;
        let errorCount = 0;
        
        // Process each item
        for (const itemName of items) {
            try {
                // Create item object with required fields
                const item = {
                    name: itemName,
                    barcode: '', // Left blank as requested
                    count: 0, // Set to 0 as requested
                    lowCount: 0, // Set to 0 as requested (this is "LOW ITEM" field)
                    cost: 0, // Set to 0 as requested
                    storageType: getStorageType(itemName)
                };
                
                // Add item to database
                const itemId = await addItemToDatabase(item);
                console.log(`✅ Added "${itemName}" (Storage: ${item.storageType})`);
                addedCount++;
                
                // Add a small delay to avoid overwhelming the database
                await new Promise(resolve => setTimeout(resolve, 50));
                
            } catch (error) {
                console.error(`❌ Error adding item "${itemName}":`, error.message);
                errorCount++;
            }
        }
        
        // Summary
        console.log('\n📊 Final Summary:');
        console.log(`🗑️  Items deleted: ${deletedCount}`);
        console.log(`✅ Items added: ${addedCount}`);
        console.log(`❌ Items with errors: ${errorCount}`);
        console.log(`📝 Total items processed: ${items.length}`);
        
    } catch (error) {
        console.error('❌ Fatal error:', error);
        process.exit(1);
    }
}

// Run the script
console.log('🚀 Starting to add unique items to Firebase database...\n');
addUniqueItems()
    .then(() => {
        console.log('\n🎉 Script completed successfully!');
        process.exit(0);
    })
    .catch((error) => {
        console.error('\n💥 Script failed:', error);
        process.exit(1);
    });