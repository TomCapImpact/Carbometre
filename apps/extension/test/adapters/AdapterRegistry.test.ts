import type { FallbackHint } from '@carbometre/core';
import { describe, expect, it } from 'vitest';
import { AdapterRegistry } from '../../src/adapters/AdapterRegistry.js';
import { type RawResponse, SiteAdapter } from '../../src/adapters/SiteAdapter.js';

class StubAdapter extends SiteAdapter {
  constructor(readonly hostPatterns: readonly string[], readonly providerId: string) {
    super();
  }
  observeResponses(_onResponse: (response: RawResponse) => void): () => void {
    return () => {};
  }
  detectModelId(): string | null {
    return null;
  }
  fallbackModel(): FallbackHint {
    return { providerId: 'stub', tier: 'mid' };
  }
  currentConversationId(): string | null {
    return null;
  }
}

describe('AdapterRegistry', () => {
  it('resolves an adapter for an exact host match', () => {
    const claude = new StubAdapter(['claude.ai'], 'claude');
    const registry = new AdapterRegistry([claude]);
    expect(registry.resolveForHost('claude.ai')).toBe(claude);
  });

  it('resolves an adapter for a subdomain of a registered host', () => {
    const chatgpt = new StubAdapter(['chatgpt.com'], 'chatgpt');
    const registry = new AdapterRegistry([chatgpt]);
    expect(registry.resolveForHost('chat.chatgpt.com')).toBe(chatgpt);
  });

  it('does not match an unrelated host that merely contains the pattern as a substring', () => {
    const claude = new StubAdapter(['claude.ai'], 'claude');
    const registry = new AdapterRegistry([claude]);
    expect(registry.resolveForHost('notclaude.ai')).toBeNull();
    expect(registry.resolveForHost('claude.ai.evil.example')).toBeNull();
  });

  it('returns null when no adapter matches', () => {
    const registry = new AdapterRegistry([new StubAdapter(['claude.ai'], 'claude')]);
    expect(registry.resolveForHost('example.com')).toBeNull();
  });

  it('picks the first matching adapter, so registration order can disambiguate overlaps', () => {
    const first = new StubAdapter(['example.com'], 'first');
    const second = new StubAdapter(['example.com'], 'second');
    const registry = new AdapterRegistry([first, second]);
    expect(registry.resolveForHost('example.com')).toBe(first);
  });
});
