import { build } from 'esbuild';

await build({
  entryPoints: ['src/content.ts'],
  outfile: 'dist/content.js',
  bundle: true,
  format: 'iife',
  target: 'es2022',
  minify: true,
  sourcemap: true,
  logLevel: 'info',
});
