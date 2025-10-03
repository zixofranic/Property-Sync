# Version bump and push script
Write-Host "Bumping version..." -ForegroundColor Cyan

# Run version bump script
node scripts/bump-version.js

if ($LASTEXITCODE -ne 0) {
    Write-Host "Failed to bump version" -ForegroundColor Red
    exit 1
}

# Stage version files
git add VERSION package.json api/package.json web/package.json 2>$null

# Check if there are changes to commit
$hasChanges = git diff --cached --quiet; $?
if (-not $hasChanges) {
    Write-Host "Version files updated and staged" -ForegroundColor Green

    # Amend the last commit with version bump
    git commit --amend --no-edit --no-verify

    if ($LASTEXITCODE -eq 0) {
        Write-Host "Version bump added to last commit" -ForegroundColor Green
    }
} else {
    Write-Host "No version changes to commit" -ForegroundColor Yellow
}

# Push to remote
Write-Host "Pushing to remote..." -ForegroundColor Cyan
git push

if ($LASTEXITCODE -eq 0) {
    Write-Host "Successfully pushed to remote!" -ForegroundColor Green

    # Read and display new version
    $version = Get-Content VERSION
    Write-Host "Current version: $version" -ForegroundColor Cyan
} else {
    Write-Host "Failed to push" -ForegroundColor Red
    exit 1
}
