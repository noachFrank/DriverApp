#!/bin/bash
# Strip nested frameworks from Square SDK for App Store submission
# This script is run by EAS Build after the iOS build completes

echo "=== Stripping nested frameworks from Square SDK ==="

# Find the app bundle
APP_PATH=$(find ~/Library/Developer/Xcode/DerivedData -name "*.app" -type d 2>/dev/null | grep -v "Intermediates" | head -1)

if [ -z "$APP_PATH" ]; then
    # Try to find in build output
    APP_PATH=$(find . -name "*.app" -type d 2>/dev/null | head -1)
fi

if [ -z "$APP_PATH" ]; then
    echo "Could not find app bundle, skipping framework stripping"
    exit 0
fi

echo "Found app at: $APP_PATH"

FRAMEWORKS_PATH="$APP_PATH/Frameworks"

if [ -d "$FRAMEWORKS_PATH" ]; then
    echo "Processing frameworks in: $FRAMEWORKS_PATH"
    
    # Remove nested Frameworks directories from Square SDKs
    find "$FRAMEWORKS_PATH" -name "Square*.framework" -type d | while read framework; do
        if [ -d "$framework/Frameworks" ]; then
            echo "Removing nested Frameworks from: $framework"
            rm -rf "$framework/Frameworks"
        fi
        # Remove setup file that causes signing issues
        if [ -f "$framework/setup" ]; then
            echo "Removing setup file from: $framework"
            rm -f "$framework/setup"
        fi
    done
    
    echo "Done stripping nested frameworks"
else
    echo "No Frameworks directory found at $FRAMEWORKS_PATH"
fi
