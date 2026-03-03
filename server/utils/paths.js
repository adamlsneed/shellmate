import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function expandHome(p) {
  return p && p.startsWith('~') ? path.join(os.homedir(), p.slice(1)) : (p || '');
}

/**
 * Returns the correct dist/ directory path for serving static files.
 * Handles three contexts: Electron packaged (asar), Electron dev, and npx/CLI.
 */
export function getDistPath() {
  let distPath = path.join(__dirname, '../../dist');

  // In a packaged Electron app, __dirname is inside app.asar.
  // Since dist/ is in asarUnpack, swap to the unpacked path.
  if (distPath.includes('app.asar')) {
    distPath = distPath.replace('app.asar', 'app.asar.unpacked');
  }

  return distPath;
}
