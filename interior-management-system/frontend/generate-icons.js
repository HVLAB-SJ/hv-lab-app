import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// SVG content with black background and thin white cross
const svgContent = `
<svg width="512" height="512" viewBox="0 0 512 512" fill="none" xmlns="http://www.w3.org/2000/svg">
  <!-- Background -->
  <rect width="512" height="512" rx="128" fill="#000000"/>

  <!-- Thin + symbol in white -->
  <!-- Vertical bar -->
  <rect x="252" y="96" width="8" height="320" rx="4" fill="#ffffff"/>

  <!-- Horizontal bar -->
  <rect x="96" y="252" width="320" height="8" rx="4" fill="#ffffff"/>
</svg>
`;

async function generateIcons() {
  const svgBuffer = Buffer.from(svgContent);

  // Generate different sizes
  const sizes = [
    { size: 192, name: 'icon-192.png' },
    { size: 512, name: 'icon-512.png' },
    { size: 32, name: 'favicon.png' }
  ];

  for (const { size, name } of sizes) {
    await sharp(svgBuffer)
      .resize(size, size)
      .png()
      .toFile(path.join(__dirname, 'public', name));

    console.log(`Generated ${name} (${size}x${size})`);
  }

  console.log('All icons generated successfully!');
}

generateIcons().catch(console.error);