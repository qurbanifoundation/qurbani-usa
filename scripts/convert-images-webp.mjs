/**
 * Bulk-convert public/images PNG + JPG → WebP.
 * Keeps originals on disk so fallbacks still work.
 * Skips files that already have a .webp sibling.
 */

import sharp from 'sharp';
import { readdirSync, statSync, existsSync } from 'fs';
import { join, extname, basename } from 'path';

const DIR = 'public/images';

function* walk(dir) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) yield* walk(full);
    else yield full;
  }
}

const targets = [];
for (const file of walk(DIR)) {
  const ext = extname(file).toLowerCase();
  if (!['.png', '.jpg', '.jpeg'].includes(ext)) continue;
  const webpPath = file.replace(/\.(png|jpg|jpeg)$/i, '.webp');
  if (existsSync(webpPath)) continue;
  targets.push({ src: file, out: webpPath });
}

console.log(`Converting ${targets.length} images...`);

let totalBefore = 0, totalAfter = 0;
for (const { src, out } of targets) {
  try {
    const meta = await sharp(src).metadata();
    const maxWidth = Math.min(meta.width || 1920, 1920);
    await sharp(src)
      .resize({ width: maxWidth, withoutEnlargement: true })
      .webp({ quality: 82 })
      .toFile(out);
    const before = statSync(src).size;
    const after = statSync(out).size;
    totalBefore += before;
    totalAfter += after;
    const savedPct = (((before - after) / before) * 100).toFixed(0);
    console.log(`  ${basename(src)}: ${(before / 1024).toFixed(0)} KB → ${(after / 1024).toFixed(0)} KB (-${savedPct}%)`);
  } catch (e) {
    console.error(`  Failed ${src}: ${e.message}`);
  }
}

console.log(`\nTotal: ${(totalBefore / 1024 / 1024).toFixed(1)} MB → ${(totalAfter / 1024 / 1024).toFixed(1)} MB (saved ${((totalBefore - totalAfter) / 1024 / 1024).toFixed(1)} MB)`);
