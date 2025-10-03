const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Common RequestWithUser interface to add at the top of controller files
const REQUEST_WITH_USER_INTERFACE = `
interface RequestWithUser extends Express.Request {
  user: { id: string; sub: string; email: string };
}
`;

// List of controller files that need the RequestWithUser interface
const controllerFiles = [
  'src/timelines/timelines.controller.ts',
  'src/share/share.controller.ts',
  'src/spark/spark.controller.ts',
  'src/users/users.controller.ts',
  'src/messaging/messaging.controller.ts',
  'src/messaging/conversations-v2.controller.ts',
  'src/mls-parser/mls-parser.controller.ts',
  'src/mls-parser/batch.controller.ts',
];

// Fix unused variable errors by prefixing with underscore
function fixUnusedVars(content) {
  // Fix unused error in catch blocks
  content = content.replace(/catch\s*\(\s*error\s*\)/g, 'catch (_error)');

  // Fix unused password variables
  content = content.replace(/const\s+{\s*password\s*,/g, 'const { password: _password,');

  // Fix unused preferences variables
  content = content.replace(/,\s*preferences\s*:/g, ', _preferences:');

  // Fix unused req variables
  content = content.replace(/@Request\(\)\s+req\s*:/g, '@Request() _req:');

  return content;
}

// Fix error.message patterns
function fixErrorMessages(content) {
  // Add proper typing for error in catch blocks that access .message
  content = content.replace(
    /catch\s*\(_error\)\s*{([^}]*?)_error\.message/gs,
    'catch (_error) {$1(_error as Error).message'
  );
  content = content.replace(
    /catch\s*\(error\)\s*{([^}]*?)error\.message/gs,
    'catch (error) {$1(error as Error).message'
  );

  return content;
}

// Remove async from functions that don't have await
function removeUnnecessaryAsync(content) {
  // This is complex and error-prone, so we'll skip automated fixing
  return content;
}

// Add RequestWithUser interface to controllers
function addRequestWithUserInterface(content, filePath) {
  if (filePath.includes('.controller.ts')) {
    // Check if interface already exists
    if (!content.includes('interface RequestWithUser')) {
      // Find the imports section and add after it
      const importMatch = content.match(/(import[\s\S]*?from ['"]][^;]*;)\n\n/);
      if (importMatch) {
        content = content.replace(
          importMatch[0],
          importMatch[0] + REQUEST_WITH_USER_INTERFACE + '\n'
        );
      }
    }

    // Replace @Request() req with @Request() req: RequestWithUser
    content = content.replace(
      /@Request\(\)\s+req(?!:)/g,
      '@Request() req: RequestWithUser'
    );
    content = content.replace(
      /@Request\(\)\s+_req(?!:)/g,
      '@Request() _req: RequestWithUser'
    );
  }

  return content;
}

// Process a file
function processFile(filePath) {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    const original = content;

    content = fixUnusedVars(content);
    content = fixErrorMessages(content);
    content = addRequestWithUserInterface(content, filePath);

    if (content !== original) {
      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`✓ Fixed: ${filePath}`);
      return true;
    }
    return false;
  } catch (err) {
    console.error(`✗ Error processing ${filePath}:`, err.message);
    return false;
  }
}

// Main execution
console.log('Starting automated lint error fixes...\n');

let fixedCount = 0;

// Fix controller files
console.log('Fixing controller files...');
controllerFiles.forEach(file => {
  const fullPath = path.join(__dirname, file);
  if (fs.existsSync(fullPath)) {
    if (processFile(fullPath)) fixedCount++;
  }
});

// Find and fix all service files
console.log('\nFinding all .service.ts files...');
const findServices = execSync('dir /s /b src\\*.service.ts', { encoding: 'utf8' });
const serviceFiles = findServices.split('\n').filter(f => f.trim());

serviceFiles.forEach(file => {
  if (file.trim() && fs.existsSync(file.trim())) {
    if (processFile(file.trim())) fixedCount++;
  }
});

console.log(`\nCompleted! Fixed ${fixedCount} files.`);
console.log('\nRun "npm run lint" to see remaining errors.');
