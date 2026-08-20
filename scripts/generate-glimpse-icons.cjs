const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const rootDir = path.resolve(__dirname, '..');
const svgPath = path.join(rootDir, 'build', 'icon.svg');
const iconsDir = path.join(rootDir, 'build', 'icons');
const mainPng = path.join(rootDir, 'build', 'icon.png');
const mainIco = path.join(rootDir, 'build', 'icon.ico');

if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

console.log('Generating GlimpseGG icons from SVG using ImageMagick...');

const sizes = [16, 32, 48, 64, 128, 256, 512, 1024];

for (const size of sizes) {
  const targetPng = path.join(iconsDir, `${size}x${size}.png`);
  try {
    execSync(`magick -background none -density 300 "${svgPath}" -resize ${size}x${size} "${targetPng}"`, { stdio: 'pipe' });
    console.log(`✓ Generated ${size}x${size}.png`);
  } catch (err) {
    try {
      execSync(`convert -background none -density 300 "${svgPath}" -resize ${size}x${size} "${targetPng}"`, { stdio: 'pipe' });
      console.log(`✓ Generated ${size}x${size}.png (via convert)`);
    } catch (e2) {
      console.error(`Failed generating ${size}x${size}:`, e2.message);
    }
  }
}

// Copy 512x512 to main icon.png
if (fs.existsSync(path.join(iconsDir, '512x512.png'))) {
  fs.copyFileSync(path.join(iconsDir, '512x512.png'), mainPng);
  console.log('✓ Copied 512x512 to build/icon.png');
}

// Generate Windows .ico
try {
  const icoSizes = [16, 32, 48, 64, 128, 256].map(s => `"${path.join(iconsDir, `${s}x${s}.png`)}"`).join(' ');
  execSync(`magick ${icoSizes} "${mainIco}"`, { stdio: 'pipe' });
  console.log('✓ Generated build/icon.ico');
} catch (e) {
  try {
    const icoSizes = [16, 32, 48, 64, 128, 256].map(s => `"${path.join(iconsDir, `${s}x${s}.png`)}"`).join(' ');
    execSync(`convert ${icoSizes} "${mainIco}"`, { stdio: 'pipe' });
    console.log('✓ Generated build/icon.ico (via convert)');
  } catch (e2) {
    console.warn('Could not generate multi-layer ico:', e2.message);
  }
}

console.log('🎉 All GlimpseGG icons generated successfully!');
