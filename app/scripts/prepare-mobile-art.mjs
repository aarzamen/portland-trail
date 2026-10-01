// Make lighter phone-sized scene copies with macOS sips; preserve every source.
import { readdir, mkdir, readFile, writeFile, stat } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const assets = fileURLToPath(new URL('../assets/', import.meta.url));
await mkdir(join(assets, 'mobile'), { recursive: true });
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const images = [];
for (const file of (await readdir(assets)).filter(file => file.endsWith('.jpg')).sort()) {
  const source = join(assets, file);
  for (const width of [640, 960]) {
    const output = `mobile/${file.replace('.jpg', '')}-${width}.jpg`;
    execFileSync('sips', ['--resampleWidth', String(width), '-s', 'formatOptions', '72', source, '--out', join(assets, output)]);
    images.push({ file: output, source: file, width, bytes: (await stat(join(assets, output))).size,
      sha256: hash(await readFile(join(assets, output))), source_sha256: hash(await readFile(source)) });
  }
}
await writeFile(join(assets, 'mobile-images.json'), JSON.stringify({ version: 1, images }, null, 2) + '\n');
console.log(`Exported ${images.length} phone-sized scene images without altering sources.`);
