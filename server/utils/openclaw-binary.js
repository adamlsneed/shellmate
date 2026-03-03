import path from 'path';
import { fileURLToPath } from 'url';
import { existsSync } from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function getOpenclawBinary() {
  // 1. Packaged Electron app — binary in extraResources
  if (process.resourcesPath) {
    const packaged = path.join(process.resourcesPath, 'openclaw', 'openclaw');
    if (existsSync(packaged)) return packaged;
  }

  // 2. Dev mode — binary in resources/ at project root
  const devBin = path.join(__dirname, '../../resources/openclaw/openclaw');
  if (existsSync(devBin)) return devBin;

  // 3. Fallback to system PATH
  return 'openclaw';
}
