import { existsSync, mkdirSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = resolve(__filename, '..');
const projectRoot = resolve(__dirname, '..');
const extensionDir = resolve(projectRoot, 'dist');

async function waitForFiles(paths: string[], timeoutMs = 120000) {
  const startedAt = Date.now();
  const pending = new Set(paths.map(p => resolve(extensionDir, p)));
  while (pending.size > 0) {
    for (const filePath of Array.from(pending)) {
      if (existsSync(filePath)) {
        try {
          const content = await readFile(filePath, 'utf-8');
          if (content && content.length > 0) {
            if (filePath.endsWith('manifest.json')) {
              try {
                JSON.parse(content);
              } catch {
                continue;
              }
            }
            pending.delete(filePath);
          }
        } catch {}
      }
    }
    if (pending.size === 0) return;
    if (Date.now() - startedAt > timeoutMs) {
      throw new Error(`Timed out waiting for files:\n${[...pending].join('\n')}`);
    }
    await new Promise(r => setTimeout(r, 400));
  }
}

function launchOnMac(): boolean {
  const userDataDir = join(tmpdir(), 'hackathon-extension-dev-profile');
  if (!existsSync(userDataDir)) {
    mkdirSync(userDataDir, { recursive: true });
  }

  const bins = [
    '/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
  ];

  const chromeArgs = [
    `--user-data-dir=${userDataDir}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-gpu',
    '--disable-dev-shm-usage',
    `--disable-extensions-except=${extensionDir}`,
    `--load-extension=${extensionDir}`,
    'about:blank',
  ];

  for (const bin of bins) {
    if (existsSync(bin)) {
      console.log(`[open-browser] Launching Chrome: ${bin}`);
      console.log(`[open-browser] Extension dir: ${extensionDir}`);
      console.log(`[open-browser] Args: ${chromeArgs.join(' ')}`);
      try {
        const child = spawn(bin, chromeArgs, { stdio: 'inherit', cwd: projectRoot });
        child.on('error', err => console.error('[open-browser] Spawn error:', err));
        return true;
      } catch (e) {
        console.error('[open-browser] Failed to spawn Chrome binary:', e);
      }
    }
  }

  // Fallback to open if direct spawn fails
  const args = [
    '-na',
    'Google Chrome',
    '--args',
    ...chromeArgs,
  ];
  console.log('[open-browser] Fallback to open with args:', args.join(' '));
  const child = spawn('open', args, { stdio: 'inherit', cwd: projectRoot });
  child.on('error', err => {
    console.error('Failed to launch Chrome via open:', err);
  });
  return true;
}

function launchGeneric(): boolean {
  const userDataDir = join(tmpdir(), 'hackathon-extension-dev-profile');
  if (!existsSync(userDataDir)) {
    mkdirSync(userDataDir, { recursive: true });
  }

  const candidates = [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    'google-chrome',
    'chromium',
    'chromium-browser',
  ];

  for (const bin of candidates) {
    try {
      const child = spawn(bin, [
        `--user-data-dir=${userDataDir}`,
        '--no-first-run',
        '--no-default-browser-check',
        '--disable-gpu',
        '--disable-dev-shm-usage',
        `--disable-extensions-except=${extensionDir}`,
        `--load-extension=${extensionDir}`,
        'about:blank',
      ], { stdio: 'inherit', cwd: projectRoot });
      child.on('error', () => {});
      return true;
    } catch {
      // try next
    }
  }
  return false;
}

(async () => {
  console.log(`Waiting for extension build at: ${extensionDir}`);
  await waitForFiles([
    'manifest.json',
    'content/all.iife.js',
    'content/example.iife.js',
    'content-ui/all.iife.js',
    'content-ui/example.iife.js',
  ]);
  console.log('Required build artifacts found. Launching Chromium/Chrome...');

  const launched = process.platform === 'darwin' ? launchOnMac() : launchGeneric();
  if (!launched) {
    console.error('Could not locate a Chrome/Chromium binary. Please open Chrome and load the unpacked extension from:', extensionDir);
    process.exitCode = 1;
    return;
  }

  console.log('Chrome launched with unpacked extension. If you close it, re-run: pnpm open-browser');
})();


