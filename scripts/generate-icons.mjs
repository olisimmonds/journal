// One-off/regenerable script: rasterizes the SVG sources in scripts/ into
// the PNG icon sizes the PWA manifest and iOS home screen require.
// Run with: node scripts/generate-icons.mjs
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const __dirname = dirname(fileURLToPath(import.meta.url))
const iconsDir = join(__dirname, '..', 'public', 'icons')

const standardSvg = readFileSync(join(__dirname, 'icon-source.svg'))
const maskableSvg = readFileSync(join(__dirname, 'icon-source-maskable.svg'))

async function generate() {
  await sharp(standardSvg).resize(192, 192).png().toFile(join(iconsDir, 'icon-192.png'))
  await sharp(standardSvg).resize(512, 512).png().toFile(join(iconsDir, 'icon-512.png'))
  await sharp(maskableSvg)
    .resize(512, 512)
    .png()
    .toFile(join(iconsDir, 'icon-maskable-512.png'))
  await sharp(standardSvg)
    .resize(180, 180)
    .png()
    .toFile(join(iconsDir, 'apple-touch-icon.png'))

  console.log('Generated icons in public/icons/')
}

generate()
