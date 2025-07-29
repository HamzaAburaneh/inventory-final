const Tesseract = require('tesseract.js');
const { createObjectCsvWriter } = require('csv-writer');
const fs = require('fs');
const path = require('path');

const screenshotsDir = path.join(__dirname, '../Screenshots');
const outputCsvPath = path.join(__dirname, 'CNE_transactions_2024.csv');

// Precise coordinates based on your input
const rowDefinitions = [
    { y: 875, height: 146 },
    { y: 1025, height: 146 },
    { y: 1175, height: 146 },
    { y: 1325, height: 146 },
    { y: 1475, height: 146 },
];

const columnDefinitions = {
    itemName: { x: 32, width: 173 },
    type: { x: 215, width: 140 },
    itemCount: { x: 400, width: 140 },
    dateTime: { x: 540, width: 243 },
};

async function processScreenshots() {
    console.log('Initializing Tesseract worker...');
    const worker = await Tesseract.createWorker('eng');
    
    console.log('Starting screenshot processing...');
    const files = fs.readdirSync(screenshotsDir)
        .filter(file => file.endsWith('.png'))
        .sort((a, b) => {
            const numA = parseInt(a.match(/\d+/)[0], 10);
            const numB = parseInt(b.match(/\d+/)[0], 10);
            return numA - numB;
        });

    let allTransactions = [];
    let processedCount = 0;

    for (const file of files) {
        processedCount++;
        const imagePath = path.join(screenshotsDir, file);
        console.log(`Processing ${file} (${processedCount}/${files.length})...`);

        for (const row of rowDefinitions) {
            try {
                const transaction = {};
                
                for (const colName in columnDefinitions) {
                    const col = columnDefinitions[colName];
                    const rect = { left: col.x, top: row.y, width: col.width, height: row.height };
                    const { data: { text } } = await worker.recognize(imagePath, { rectangle: rect });
                    transaction[colName] = text.trim().replace(/\n/g, ' ').replace(/\|/g, '');
                }

                const itemName = transaction.itemName.replace(/[^a-zA-Z0-9\s]/g, '').trim();
                const type = transaction.type.toLowerCase().includes('add') ? 'add' : 'remove';
                const itemCountMatch = transaction.itemCount.match(/\d+/);
                const itemCount = itemCountMatch ? parseInt(itemCountMatch[0], 10) : null;
                const dateTimeMatch = transaction.dateTime.replace(/[^0-9-:\s]/g, '').match(/\d{4}-\d{2}-\d{2}\s\d{2}:\d{2}:\d{2}/);
                const dateTime = dateTimeMatch ? dateTimeMatch[0] : null;

                if (itemName && itemCount && dateTime) {
                    allTransactions.push({
                        item_name: itemName,
                        transaction_type: type,
                        item_count: itemCount,
                        date_time: dateTime,
                    });
                }
            } catch (error) {
                console.error(`Error processing a row in ${file}:`, error.message);
            }
        }
    }

    await worker.terminate();

    const csvWriter = createObjectCsvWriter({
        path: outputCsvPath,
        header: [
            { id: 'item_name', title: 'item_name' },
            { id: 'transaction_type', title: 'transaction_type' },
            { id: 'item_count', title: 'item_count' },
            { id: 'date_time', title: 'date_time' },
        ],
    });

    await csvWriter.writeRecords(allTransactions);

    console.log(`Finished processing all screenshots. CSV created at ${outputCsvPath}`);
}

processScreenshots();