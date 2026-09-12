import type { SiteAdapter } from './SiteAdapter.js';

function matchesHost(host: string, pattern: string): boolean {
  return host === pattern || host.endsWith(`.${pattern}`);
}

/** Picks the right SiteAdapter for the current page. Registering a new site is one constructor argument. */
export class AdapterRegistry {
  constructor(private readonly adapters: readonly SiteAdapter[]) {}

  resolveForHost(host: string): SiteAdapter | null {
    return this.adapters.find((adapter) => adapter.hostPatterns.some((pattern) => matchesHost(host, pattern))) ?? null;
  }
}
