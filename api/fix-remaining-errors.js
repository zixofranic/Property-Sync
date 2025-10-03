const fs = require('fs');
const path = require('path');

function fixRemainingErrors(filePath) {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    const original = content;

    // Fix: catch (_error) { ... throw error }
    content = content.replace(/catch\s*\(_error\)\s*{([^}]*?)throw\s+error([^}]*?)}/gs, (match, before, after) => {
      return `catch (_error) {${before}throw _error${after}}`;
    });

    // Fix: catch (_error) { ... error (not as Error) }
    // This targets console.error, console.log, etc with bare "error"
    content = content.replace(/catch\s*\(_error\)\s*{([^}]*?)\b(console\.[a-z]+\([^)]*?)\berror\b([^)]*)}/gs, (match, before, consoleStart, consoleEnd) => {
      // Only replace if it's not already (_error as Error)
      if (!consoleStart.includes('(_error as Error)') && !consoleStart.includes('_error')) {
        return `catch (_error) {${before}${consoleStart}_error${consoleEnd}}`;
      }
      return match;
    });

    // Fix: shouldFallbackToNodemailer(error) when catch is _error
    content = content.replace(/catch\s*\(_error\)\s*{([^}]*?)shouldFallbackToNodemailer\(error\)/gs, (match, inside) => {
      return `catch (_error) {${inside}shouldFallbackToNodemailer(_error as Error)`;
    });

    // Fix: throw error in email.service.ts after catching _error
    content = content.replace(/catch\s*\(_error\)\s*{([^}]*?)throw\s+error;/gs, (match, inside) => {
      return `catch (_error) {${inside}throw _error;`;
    });

    //  Fix users.service line 158: throw error should be throw _error
    content = content.replace(/catch\s*\(_error\)\s*{([^}]*?)console\.error\([^)]*?\(_error as Error\)\.message\);([^}]*?)throw\s+error;/gs, (match, before, after) => {
      return `catch (_error) {${before}console.error('Profile update failed:', (_error as Error).message);${after}throw _error;`;
    });

    // Fix spark.service.ts patterns: error.stack after catch (_error)
    content = content.replace(/catch\s*\(_error\)\s*{([^}]*?)\berror\.stack\b/gs, (match, inside) => {
      return `catch (_error) {${inside}(_error as Error).stack`;
    });

    // Fix spark.service.ts patterns: throw error after catch (_error)
    content = content.replace(/catch\s*\(_error\)\s*{([^}]*?)this\.logger\.[a-z]+\([^)]*?\(_error as Error\)\.[a-z]+\);([^}]*?)throw\s+error;/gs, (match, before, after) => {
      return match.replace('throw error;', 'throw _error;');
    });

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
  if (fixRemainingErrors(file)) {
    fixedCount++;
  }
}

console.log(`\nFixed ${fixedCount} files`);
