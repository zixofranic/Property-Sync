const fs = require('fs');
const path = require('path');

// Find all TypeScript files in src
function findTsFiles(dir) {
  const files = [];
  const items = fs.readdirSync(dir, { withFileTypes: true });

  for (const item of items) {
    const fullPath = path.join(dir, item.name);
    if (item.isDirectory() && item.name !== 'node_modules') {
      files.push(...findTsFiles(fullPath));
    } else if (item.isFile() && item.name.endsWith('.ts')) {
      files.push(fullPath);
    }
  }

  return files;
}

// Fix catch blocks that use error.message after _error
function fixCatchBlocks(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  const original = content;
  let modified = false;

  // Pattern: catch (_error) { ... error.message ... }
  // We need to fix cases where _error is caught but error is used
  const catchBlockRegex = /catch\s*\(_error\)\s*{([^}]*error\.(?:message|code|statusCode|stack|name))/g;

  // For each match, we need to replace error. with (_error as Error).
  content = content.replace(catchBlockRegex, (match) => {
    // Replace all instances of error. with (_error as Error).
    let fixed = match.replace(/\berror\.(message|code|statusCode|stack|name)/g, '(_error as Error).$1');
    return fixed;
  });

  if (content !== original) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`✓ Fixed catch blocks in: ${path.relative(process.cwd(), filePath)}`);
    return true;
  }

  return false;
}

// Main execution
const srcDir = path.join(__dirname, 'src');
const tsFiles = findTsFiles(srcDir);

console.log(`Found ${tsFiles.length} TypeScript files\n`);

let fixedCount = 0;
for (const file of tsFiles) {
  if (fixCatchBlocks(file)) {
    fixedCount++;
  }
}

console.log(`\nFixed ${fixedCount} files`);
