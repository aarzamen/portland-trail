// Runs the browser suites (app/tests/browser-*.mjs) in name order. It builds the game, starts one server for
// the source and one for the build on free ports, runs each suite with TEST_URL (source) and TEST_DIST_URL
// (build) and PLAYWRIGHT_CHANNEL (default chrome), streams the suites' output, stops the servers, prints one
// summary line per suite and exits 1 when any suite failed.
//
//   node scripts/test-browser.mjs [name …]   only the suites whose file names contain one of the names
import { spawn } from 'node:child_process';
import { readdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const appRoot = fileURLToPath(new URL('../', import.meta.url));
const testsFolder = join(appRoot, 'tests');
// Servers and suites never outlive the runner, also when it is interrupted.
const children = new Set();
process.on('exit', () => {
  for (const child of children) child.kill();
});
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => process.exit(130));

/** Runs a Node script with the output streamed through and resolves with its exit code. */
function runNode(args, env = process.env) {
  return new Promise(resolve => {
    const child = spawn(process.execPath, args, { cwd: appRoot, env, stdio: 'inherit' });
    children.add(child);
    child.on('error', () => resolve(1));
    child.on('exit', (code, signal) => {
      children.delete(child);
      resolve(signal ? `signal ${signal}` : code);
    });
  });
}

/** Starts serve.mjs on a free port and resolves with its address once it prints one. */
function startServer(args) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [join(appRoot, 'scripts/serve.mjs'), ...args], {
      cwd: appRoot,
      env: { ...process.env, PORT: '0' },
      stdio: ['ignore', 'pipe', 'inherit'],
    });
    children.add(child);
    child.stdout.setEncoding('utf8');
    let output = '';
    const timer = setTimeout(() => reject(new Error(`serve.mjs ${args.join(' ')} printed no address.`)), 10_000);
    child.stdout.on('data', chunk => {
      output += chunk;
      const match = output.match(/http:\/\/127\.0\.0\.1:\d+\//);
      if (!match) return;
      clearTimeout(timer);
      child.stdout.resume();
      resolve({ child, url: match[0] });
    });
    child.on('exit', code => {
      children.delete(child);
      clearTimeout(timer);
      reject(new Error(`serve.mjs ${args.join(' ')} exited with ${code}.`));
    });
  });
}

async function stopServer(server) {
  if (!server || server.child.exitCode !== null || server.child.signalCode !== null) return;
  const exited = new Promise(resolve => server.child.once('exit', resolve));
  server.child.kill();
  await exited;
}

async function main() {
  try {
    createRequire(import.meta.url).resolve('playwright');
  } catch {
    console.error('Playwright is not installed. Run npm install in app/ first.');
    return 1;
  }
  const wanted = process.argv.slice(2);
  const suites = (await readdir(testsFolder))
    .filter(name => /^browser-.+\.mjs$/.test(name))
    .filter(name => !wanted.length || wanted.some(part => name.includes(part)))
    .sort();
  if (!suites.length) {
    console.error(`No browser suites${wanted.length ? ` match ${wanted.join(', ')}` : ''} in app/tests.`);
    return 1;
  }

  const built = await runNode([join(appRoot, 'scripts/build.mjs')]);
  if (built !== 0) {
    console.error('The build failed; no suites were run.');
    return 1;
  }
  let source;
  let dist;
  const results = [];
  try {
    source = await startServer([]);
    dist = await startServer(['--dist']);
    const env = {
      ...process.env,
      TEST_URL: source.url,
      TEST_DIST_URL: dist.url,
      PLAYWRIGHT_CHANNEL: process.env.PLAYWRIGHT_CHANNEL || 'chrome',
    };
    console.log(`Source ${source.url}, build ${dist.url}, browser channel ${env.PLAYWRIGHT_CHANNEL}.`);
    for (const suite of suites) {
      console.log(`\n▶ ${suite}`);
      const started = performance.now();
      const code = await runNode([join(testsFolder, suite)], env);
      results.push({ suite, code, seconds: (performance.now() - started) / 1000 });
    }
  } finally {
    await Promise.all([stopServer(source), stopServer(dist)]);
  }

  console.log('\nBrowser suites:');
  for (const { suite, code, seconds } of results) {
    const outcome = code === 0 ? 'pass' : `FAIL (${typeof code === 'number' ? `exit ${code}` : code})`;
    console.log(`  ${outcome.padEnd(16)} ${suite.padEnd(28)} ${seconds.toFixed(1)} s`);
  }
  const failed = results.filter(result => result.code !== 0).length;
  const total = `${results.length} ${results.length === 1 ? 'suite' : 'suites'}`;
  console.log(`${total}, ${results.length - failed} passed, ${failed} failed.`);
  return failed ? 1 : 0;
}

try {
  process.exitCode = await main();
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
