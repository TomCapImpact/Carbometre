import { cpSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));

mkdirSync(`${root}/dist`, { recursive: true });
cpSync(`${root}/manifest.json`, `${root}/dist/manifest.json`);
cpSync(`${root}/_locales`, `${root}/dist/_locales`, { recursive: true });
cpSync(`${root}/src/styles/ui.css`, `${root}/dist/ui.css`);
cpSync(`${root}/methodology.html`, `${root}/dist/methodology.html`);
cpSync(`${root}/icons`, `${root}/dist/icons`, { recursive: true });

console.log('Copied manifest.json, _locales/, icons/, ui.css and methodology.html to dist/');
