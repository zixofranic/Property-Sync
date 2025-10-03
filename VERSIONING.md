# Version Management

This project uses automatic semantic versioning to track releases.

## Current Version

The current version is stored in the `VERSION` file at the root of the project.

## How It Works

1. **VERSION File**: Single source of truth for the version number
2. **Automatic Sync**: Version is automatically synced to:
   - Root `package.json`
   - `api/package.json`
   - `web/package.json`

## Version Increment

### Automatic (Recommended)

Use the version-push command to bump version and push in one step:

```bash
npm run version:push
```

This will:
1. Increment the patch version (e.g., 1.0.0 → 1.0.1)
2. Update all package.json files
3. Amend the last commit with version bump
4. Push to remote

### Manual

To just bump the version without pushing:

```bash
npm run version:bump
```

Then commit and push manually:

```bash
git add VERSION package.json api/package.json web/package.json
git commit -m "chore: bump version to X.X.X"
git push
```

## Semantic Versioning

The version follows semantic versioning (MAJOR.MINOR.PATCH):

- **MAJOR**: Breaking changes (manually update VERSION file)
- **MINOR**: New features, backwards compatible (manually update VERSION file)
- **PATCH**: Bug fixes, patches (automatic via `npm run version:push`)

## Platform-Specific Commands

- **Windows**: `npm run version:push` (uses PowerShell)
- **Linux/Mac**: `npm run version:push:unix` (uses bash)

## Example Workflow

1. Make your changes and commit them:
   ```bash
   git add .
   git commit -m "feat: add new feature"
   ```

2. Bump version and push:
   ```bash
   npm run version:push
   ```

This automatically increments the version, amends your commit with the version bump, and pushes to remote.

## Checking Current Version

```bash
cat VERSION
```

Or check any package.json:

```bash
node -p "require('./package.json').version"
```
