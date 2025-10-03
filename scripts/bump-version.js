const fs = require('fs');
const path = require('path');

// Read current version
const versionPath = path.join(__dirname, '..', 'VERSION');
const currentVersion = fs.readFileSync(versionPath, 'utf8').trim();

// Parse version
const [major, minor, patch] = currentVersion.split('.').map(Number);

// Increment patch version
const newVersion = `${major}.${minor}.${patch + 1}`;

// Write new version
fs.writeFileSync(versionPath, newVersion);

console.log(`Version bumped: ${currentVersion} → ${newVersion}`);
console.log(`New version: ${newVersion}`);

// Also update package.json if it exists
const packagePath = path.join(__dirname, '..', 'package.json');
if (fs.existsSync(packagePath)) {
  const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
  packageJson.version = newVersion;
  fs.writeFileSync(packagePath, JSON.stringify(packageJson, null, 2) + '\n');
  console.log('Updated package.json version');
}

// Update API package.json
const apiPackagePath = path.join(__dirname, '..', 'api', 'package.json');
if (fs.existsSync(apiPackagePath)) {
  const apiPackageJson = JSON.parse(fs.readFileSync(apiPackagePath, 'utf8'));
  apiPackageJson.version = newVersion;
  fs.writeFileSync(apiPackagePath, JSON.stringify(apiPackageJson, null, 2) + '\n');
  console.log('Updated api/package.json version');
}

// Update web package.json
const webPackagePath = path.join(__dirname, '..', 'web', 'package.json');
if (fs.existsSync(webPackagePath)) {
  const webPackageJson = JSON.parse(fs.readFileSync(webPackagePath, 'utf8'));
  webPackageJson.version = newVersion;
  fs.writeFileSync(webPackagePath, JSON.stringify(webPackageJson, null, 2) + '\n');
  console.log('Updated web/package.json version');
}

process.exit(0);
