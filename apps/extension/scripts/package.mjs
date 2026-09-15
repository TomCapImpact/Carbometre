/**
 * Builds the archive to upload to the Chrome Web Store: dist/ without the
 * source maps (they are for local debugging and would triple the size),
 * named after the manifest version.
 *
 *   pnpm run package   ->  apps/extension/release/carbometre-<version>.zip
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const dist = `${root}dist`;
if (!existsSync(`${dist}/manifest.json`)) {
  console.error('dist/ is missing - run `pnpm run build` first');
  process.exit(1);
}
const { version } = JSON.parse(readFileSync(`${dist}/manifest.json`, 'utf8'));
const releaseDir = `${root}release`;
mkdirSync(releaseDir, { recursive: true });
const zip = `${releaseDir}/carbometre-${version}.zip`;
rmSync(zip, { force: true });
execFileSync('zip', ['-r', '-X', zip, '.', '-x', '*.map', '-x', '.DS_Store'], { cwd: dist, stdio: 'ignore' });
console.log(`Wrote ${zip}`);
