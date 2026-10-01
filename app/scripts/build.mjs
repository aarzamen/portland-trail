import { cp, mkdir, readdir, readFile, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const dist = join(root, 'dist');
await readFile(join(root, 'index.html'));
await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });
for (const item of ['index.html', 'src', 'assets']) {
  await cp(join(root, item), join(dist, item), { recursive: true });
}
const assets = await readdir(join(dist, 'assets'));
console.log(`Built static game in ${dist} (${assets.length} asset files).`);
