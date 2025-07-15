#!/bin/bash

# Build the extension
echo "Building extension..."
npm run build

# Create version from package.json
VERSION=$(node -p "require('./package.json').version")

# Create ZIP file
echo "Creating ZIP file..."
cd dist
zip -r ../tab-flow-v${VERSION}.zip .
cd ..

echo "✅ Created tab-flow-v${VERSION}.zip"

# Note about CRX files
echo ""
echo "📝 Note: CRX files are typically created by Chrome when you:"
echo "1. Go to chrome://extensions/"
echo "2. Enable Developer mode"
echo "3. Click 'Pack extension'"
echo "4. Select the 'dist' folder"
echo ""
echo "Or upload the ZIP to Chrome Web Store for automatic CRX generation."