#!/bin/bash
# Version bump and push script for Unix/Linux/Mac

echo "Bumping version..."

# Run version bump script
node scripts/bump-version.js

if [ $? -ne 0 ]; then
    echo "Failed to bump version"
    exit 1
fi

# Stage version files
git add VERSION package.json api/package.json web/package.json 2>/dev/null || true

# Check if there are changes to commit
if ! git diff --cached --quiet; then
    echo "Version files updated and staged"

    # Amend the last commit with version bump
    git commit --amend --no-edit --no-verify

    if [ $? -eq 0 ]; then
        echo "Version bump added to last commit"
    fi
else
    echo "No version changes to commit"
fi

# Push to remote
echo "Pushing to remote..."
git push

if [ $? -eq 0 ]; then
    echo "Successfully pushed to remote!"

    # Read and display new version
    version=$(cat VERSION)
    echo "Current version: $version"
else
    echo "Failed to push"
    exit 1
fi
