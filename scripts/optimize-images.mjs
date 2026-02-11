import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PUBLIC_DIR = path.join(__dirname, '..', 'public');

// Images to convert to WebP
const imagesToConvert = [
  'usdc.png',
  'whatsapp.png',
  'crowdfunding.png',
  'hero-crystal.png',
  'og-image.png',
  'partners/usdc.png',
  'partners/trust wallet.png',
  'partners/bitget.png',
  'partners/Binance.png',
  'partners/polygon lab.png',
  'icons/Binance.png',
  'icons/polygon lab.png',
  'levels/level-1.png',
  'levels/level-2.png',
  'levels/level-3.png',
  'levels/level-4.png',
  'levels/level-5.png',
  'levels/level-6.png',
];

async function convertToWebP(inputPath, quality = 80) {
  const outputPath = inputPath.replace('.png', '.webp');
  
  try {
    const inputStats = fs.statSync(inputPath);
    const inputSizeKB = (inputStats.size / 1024).toFixed(1);
    
    await sharp(inputPath)
      .webp({ quality })
      .toFile(outputPath);
    
    const outputStats = fs.statSync(outputPath);
    const outputSizeKB = (outputStats.size / 1024).toFixed(1);
    const savings = ((1 - outputStats.size / inputStats.size) * 100).toFixed(0);
    
    console.log(`✅ ${path.basename(inputPath)}: ${inputSizeKB}KB → ${outputSizeKB}KB (${savings}% smaller)`);
    
    return { input: inputSizeKB, output: outputSizeKB, savings };
  } catch (error) {
    console.error(`❌ Failed to convert ${inputPath}:`, error.message);
    return null;
  }
}

async function main() {
  console.log('🖼️  Starting image optimization...\n');
  
  let totalInputKB = 0;
  let totalOutputKB = 0;
  
  for (const imagePath of imagesToConvert) {
    const fullPath = path.join(PUBLIC_DIR, imagePath);
    
    if (fs.existsSync(fullPath)) {
      const result = await convertToWebP(fullPath);
      if (result) {
        totalInputKB += parseFloat(result.input);
        totalOutputKB += parseFloat(result.output);
      }
    } else {
      console.log(`⚠️  File not found: ${imagePath}`);
    }
  }
  
  console.log('\n📊 Summary:');
  console.log(`   Original total: ${totalInputKB.toFixed(1)} KB`);
  console.log(`   Optimized total: ${totalOutputKB.toFixed(1)} KB`);
  console.log(`   Total savings: ${(totalInputKB - totalOutputKB).toFixed(1)} KB (${((1 - totalOutputKB / totalInputKB) * 100).toFixed(0)}%)`);
  console.log('\n✨ Done! Now update your code to use .webp files.');
}

main();
