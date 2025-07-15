#!/usr/bin/env node

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Icon sizes needed for Chrome extensions
const sizes = [16, 32, 48, 128];

// Paths
const pngPath = path.join(__dirname, '../public/icons/icon.png');
const iconsDir = path.join(__dirname, '../public/icons');

// Check if PNG exists
if (!fs.existsSync(pngPath)) {
  console.error('❌ PNG file not found at:', pngPath);
  process.exit(1);
}

console.log('🎨 Generating icons from PNG (preserving transparency)...');
console.log('📁 PNG source:', pngPath);
console.log('📁 Output directory:', iconsDir);

// Generate PNG icons for each size
sizes.forEach(size => {
  const outputPath = path.join(iconsDir, `icon${size}.png`);
  
  try {
    // Use ImageMagick to resize PNG while preserving transparency
    const command = `magick "${pngPath}" -resize ${size}x${size} "${outputPath}"`;
    console.log(`⚡ Generating ${size}x${size} icon...`);
    execSync(command, { stdio: 'inherit' });
    
    // Verify the file was created
    if (fs.existsSync(outputPath)) {
      const stats = fs.statSync(outputPath);
      console.log(`✅ Created: icon${size}.png (${(stats.size / 1024).toFixed(1)}KB)`);
    } else {
      console.error(`❌ Failed to create: icon${size}.png`);
    }
  } catch (error) {
    console.error(`❌ Error generating icon${size}.png:`, error.message);
  }
});

console.log('\n🎉 Icon generation complete!');
console.log('📋 Generated files:');
sizes.forEach(size => {
  const outputPath = path.join(iconsDir, `icon${size}.png`);
  if (fs.existsSync(outputPath)) {
    console.log(`   ✅ public/icons/icon${size}.png`);
  } else {
    console.log(`   ❌ public/icons/icon${size}.png`);
  }
});