const fs = require('fs');
const path = require('path');

function fixAllErrorReferences(filePath) {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    const original = content;

    // Strategy: Find catch (_error) blocks and fix ALL references to bare "error" within them
    // We'll use a more comprehensive regex to capture the entire catch block

    // Match catch (_error) { ... } and fix any bare "error" references inside
    content = content.replace(
      /catch\s*\(_error\)\s*\{([\s\S]*?)(?=\n\s{2,4}\}(?:\s*catch|\s*finally|\s*$|\s*\n))/g,
      (match, catchBody) => {
        let fixed = catchBody;

        // Fix: error.message -> (_error as Error).message
        fixed = fixed.replace(/\berror\.message\b/g, '(_error as Error).message');

        // Fix: error.stack -> (_error as Error).stack
        fixed = fixed.replace(/\berror\.stack\b/g, '(_error as Error).stack');

        // Fix: error.code -> (_error as Error).code
        fixed = fixed.replace(/\berror\.code\b/g, '(_error as Error).code');

        // Fix: error.name -> (_error as Error).name
        fixed = fixed.replace(/\berror\.name\b/g, '(_error as Error).name');

        // Fix: error.statusCode -> (_error as Error).statusCode
        fixed = fixed.replace(/\berror\.statusCode\b/g, '(_error as Error).statusCode');

        // Fix: throw error -> throw _error
        fixed = fixed.replace(/\bthrow\s+error;/g, 'throw _error;');
        fixed = fixed.replace(/\bthrow\s+error\b(?!\.)/g, 'throw _error');

        // Fix: shouldFallbackToNodemailer(error) -> shouldFallbackToNodemailer(_error as Error)
        fixed = fixed.replace(/shouldFallbackToNodemailer\(error\)/g, 'shouldFallbackToNodemailer(_error as Error)');

        // Fix: fullError: error -> fullError: _error
        fixed = fixed.replace(/fullError:\s*error(?!\.)/g, 'fullError: _error');

        // Fix: any console.log/error/warn with bare error
        fixed = fixed.replace(/console\.(log|error|warn)\([^)]*\berror\b(?!\.)/g, (consoleMatch) => {
          return consoleMatch.replace(/\berror\b/g, '_error');
        });

        return `catch (_error) {${fixed}`;
      }
    );

    if (content !== original) {
      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`✓ Fixed: ${path.relative(process.cwd(), filePath)}`);
      return true;
    }

    return false;
  } catch (err) {
    console.error(`✗ Error processing ${filePath}:`, err.message);
    return false;
  }
}

// Find all TS files
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

const srcDir = path.join(__dirname, 'src');
const tsFiles = findTsFiles(srcDir);

console.log(`Processing ${tsFiles.length} TypeScript files...\n`);

let fixedCount = 0;
for (const file of tsFiles) {
  if (fixAllErrorReferences(file)) {
    fixedCount++;
  }
}

console.log(`\nFixed ${fixedCount} files`);
