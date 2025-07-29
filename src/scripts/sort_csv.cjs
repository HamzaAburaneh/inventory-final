const fs = require('fs');
const path = require('path');

const inputFilePath = process.argv[2];
const outputFilePath = process.argv[3]; // New: Optional output file path

if (!inputFilePath) {
  console.error('Usage: node sort_csv.cjs <input_csv_file_path> [output_csv_file_path]');
  process.exit(1);
}

fs.readFile(inputFilePath, 'utf8', (err, data) => {
  if (err) {
    console.error('Error reading the file:', err);
    process.exit(1);
  }

  const lines = data.trim().split('\n');
  if (lines.length === 0 || (lines.length === 1 && lines[0] === '')) {
    console.log('File is empty or contains only a header. No sorting needed.');
    // If the file is empty or only has a header, write it back as is.
    const targetPath = outputFilePath || inputFilePath;
    fs.writeFile(targetPath, data, 'utf8', (writeErr) => {
      if (writeErr) {
        console.error('Error writing the empty/header-only file:', writeErr);
        process.exit(1);
      }
      console.log(`File ${targetPath} processed (empty/header-only).`);
    });
    return;
  }

  const header = lines[0];
  const records = lines.slice(1);

  const filteredRecords = records.filter(line => line.trim() !== '');

  filteredRecords.sort((a, b) => {
    const dateA = new Date(a.substring(a.lastIndexOf(',') + 1).trim());
    const dateB = new Date(b.substring(b.lastIndexOf(',') + 1).trim());
    return dateA - dateB;
  });

  const sortedContent = header + '\n' + filteredRecords.join('\n') + '\n';

  const finalOutputPath = outputFilePath || inputFilePath; // Use outputFilePath if provided, else inputFilePath

  // Always write to a temporary file first, then rename/move
  const tempFilePath = finalOutputPath + '.tmp';
  fs.writeFile(tempFilePath, sortedContent, 'utf8', (writeErr) => {
    if (writeErr) {
      console.error('Error writing temporary file:', writeErr);
      process.exit(1);
    }

    fs.rename(tempFilePath, finalOutputPath, (renameErr) => {
      if (renameErr) {
        console.error('Error renaming temporary file:', renameErr);
        process.exit(1);
      }
      console.log(`Sorted content saved to ${finalOutputPath} successfully.`);
    });
  });
});
