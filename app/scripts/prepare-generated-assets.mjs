// Re-export the preserved generated masters with macOS's built-in sips tool.
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { join, relative } from 'node:path';

const root = fileURLToPath(new URL('../../', import.meta.url));
const masterDir = join(root, 'docs/handoff/graphics-v2');
const outputDir = join(root, 'app/assets');
const entries = JSON.parse(await readFile(join(masterDir, 'generation.json')));
const assets = [];
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
await mkdir(join(outputDir, 'icons'), { recursive: true });
for (const entry of entries) {
  const source = join(masterDir, `${entry.id}.png`);
  const sourceHash = digest(await readFile(source));
  const outputs = entry.id === 'app-icon'
    ? [['icons/icon-192.png', 192], ['icons/icon-512.png', 512], ['icons/apple-touch-icon.png', 180], ['icons/favicon-32.png', 32], ['icons/favicon-16.png', 16]]
    : [[`${entry.id}.jpg`, null]];
  for (const [file, size] of outputs) {
    const target = join(outputDir, file);
    const args = size ? ['-z', String(size), String(size)] : ['-s', 'format', 'jpeg', '-s', 'formatOptions', '85'];
    execFileSync('sips', [...args, source, '--out', target]);
    const dimensions = execFileSync('sips', ['-g', 'pixelWidth', '-g', 'pixelHeight', target], { encoding: 'utf8' });
    assets.push({ file, source: relative(root, source), source_sha256: sourceHash,
      width: Number(dimensions.match(/pixelWidth: (\d+)/)[1]), height: Number(dimensions.match(/pixelHeight: (\d+)/)[1]),
      sha256: digest(await readFile(target)) });
  }
}
await writeFile(join(outputDir, 'generated-manifest.json'), JSON.stringify({ version: 1, tool: 'built-in image_gen', assets }, null, 2) + '\n');
console.log(`Prepared ${assets.length} generated scene and icon assets.`);
