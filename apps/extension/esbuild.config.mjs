import { build } from 'esbuild';

/**
 * Four bundles, one per execution context: the content script (badge +
 * dashboard on the chat sites), the service worker, and the onboarding
 * and Options pages' scripts. Each is a self-contained IIFE; shared code
 * (storage, i18n) is simply bundled into each - it is small.
 */
await build({
  entryPoints: ['src/content.ts', 'src/background.ts', 'src/onboarding.ts', 'src/options.ts'],
  outdir: 'dist',
  bundle: true,
  format: 'iife',
  target: 'es2022',
  minify: true,
  sourcemap: true,
  logLevel: 'info',
});
