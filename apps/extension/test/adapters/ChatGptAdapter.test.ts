import { JSDOM } from 'jsdom';
import { describe, expect, it, vi } from 'vitest';
import { ChatGptAdapter } from '../../src/adapters/ChatGptAdapter.js';

function buildAdapter(html: string, url = 'https://chatgpt.com/uc/abc-123'): ChatGptAdapter {
  const dom = new JSDOM(html, { url });
  return new ChatGptAdapter(dom.window.document);
}

describe('ChatGptAdapter', () => {
  describe('currentConversationId', () => {
    it('extracts the id from a /uc/<id> URL (confirmed live)', () => {
      const adapter = buildAdapter('<html></html>', 'https://chatgpt.com/uc/6aa68515-e518-83ea-a9c8-a6ed00f7527d');
      expect(adapter.currentConversationId()).toBe('6aa68515-e518-83ea-a9c8-a6ed00f7527d');
    });

    it('also accepts the commonly-documented /c/<id> form, in case of a rollout variant', () => {
      const adapter = buildAdapter('<html></html>', 'https://chatgpt.com/c/9f8e7d6c-1234');
      expect(adapter.currentConversationId()).toBe('9f8e7d6c-1234');
    });

    it('returns null off a conversation page', () => {
      const adapter = buildAdapter('<html></html>', 'https://chatgpt.com/');
      expect(adapter.currentConversationId()).toBeNull();
    });
  });

  describe('detectModelId', () => {
    it('maps a "mini" label to gpt-small even when it also mentions gpt', () => {
      const adapter = buildAdapter('<button data-testid="model-switcher-dropdown-button">GPT-5 mini</button>');
      expect(adapter.detectModelId()).toBe('gpt-small');
    });

    it('maps a "pro"/"thinking" label to gpt-frontier', () => {
      expect(
        buildAdapter('<button data-testid="model-switcher-dropdown-button">GPT-5 Pro</button>').detectModelId(),
      ).toBe('gpt-frontier');
      expect(
        buildAdapter('<button data-testid="model-switcher-dropdown-button">GPT-5 Thinking</button>').detectModelId(),
      ).toBe('gpt-frontier');
    });

    it('maps a plain "GPT" label to gpt-mid', () => {
      expect(buildAdapter('<button data-testid="model-switcher-dropdown-button">ChatGPT 5</button>').detectModelId()).toBe(
        'gpt-mid',
      );
    });

    it('returns null when the model picker is missing or unrecognized', () => {
      expect(buildAdapter('<html></html>').detectModelId()).toBeNull();
      expect(
        buildAdapter('<button data-testid="model-switcher-dropdown-button">Mystery Model</button>').detectModelId(),
      ).toBeNull();
    });

    it('still finds the model from a short button label when no known testid matches (selector drift)', () => {
      // The exact model-picker testid was never confirmed live, so a plain
      // button carrying the model name has to be enough to classify it.
      const adapter = buildAdapter('<button class="some-hashed-class">GPT-5 Thinking</button>');
      expect(adapter.detectModelId()).toBe('gpt-frontier');
    });

    it('ignores long prose buttons that merely mention a model name', () => {
      const adapter = buildAdapter(
        `<button>Compare this answer with what GPT-5 would have produced for the same prompt</button>`,
      );
      expect(adapter.detectModelId()).toBeNull();
    });
  });

  describe('fallbackModel', () => {
    it('points at the gpt-* catalog prefix, not the adapter providerId', () => {
      // providerId is "chatgpt" but catalog entries are "gpt-frontier" etc,
      // so the hint has to carry the catalog's prefix to resolve at all.
      const adapter = buildAdapter('<html></html>');
      expect(adapter.providerId).toBe('chatgpt');
      expect(adapter.fallbackModel()).toEqual({ providerId: 'gpt', tier: 'mid' });
    });
  });


  describe('observeResponses', () => {
    it('reports a finished exchange once its assistant turn stops mutating for 800ms', async () => {
      vi.useFakeTimers();
      try {
        const adapter = buildAdapter(
          `<main>
             <div data-testid="conversation-turn-1">
               <div data-message-author-role="user">What is the capital of France?</div>
             </div>
             <div data-testid="conversation-turn-2">
               <div data-message-author-role="assistant"></div>
             </div>
           </main>`,
        );
        const replyEl = adapter['doc'].querySelector('[data-message-author-role="assistant"]') as HTMLElement;

        const responses: unknown[] = [];
        const stop = adapter.observeResponses((r) => responses.push(r));

        replyEl.textContent = 'Paris.';
        await vi.advanceTimersByTimeAsync(900);

        expect(responses).toEqual([{ promptText: 'What is the capital of France?', responseText: 'Paris.' }]);
        stop();
      } finally {
        vi.useRealTimers();
      }
    });

    it('prefers the narrower .markdown content over the whole role-holder (excludes action buttons)', async () => {
      vi.useFakeTimers();
      try {
        const adapter = buildAdapter(
          `<main>
             <div data-testid="conversation-turn-1">
               <div data-message-author-role="user">Hi</div>
             </div>
             <div data-testid="conversation-turn-2">
               <div data-message-author-role="assistant">
                 <div class="markdown"></div>
                 <button>Copy</button>
               </div>
             </div>
           </main>`,
        );
        const markdownEl = adapter['doc'].querySelector('.markdown') as HTMLElement;

        const responses: unknown[] = [];
        const stop = adapter.observeResponses((r) => responses.push(r));

        markdownEl.textContent = 'Hello!';
        await vi.advanceTimersByTimeAsync(900);

        expect(responses).toEqual([{ promptText: 'Hi', responseText: 'Hello!' }]);
        stop();
      } finally {
        vi.useRealTimers();
      }
    });

    it('does not report turns that were already in the DOM before observing started', async () => {
      vi.useFakeTimers();
      try {
        const adapter = buildAdapter(
          `<main>
             <div data-testid="conversation-turn-1">
               <div data-message-author-role="user">Hi</div>
             </div>
             <div data-testid="conversation-turn-2">
               <div data-message-author-role="assistant">Hello!</div>
             </div>
           </main>`,
        );
        const responses: unknown[] = [];
        adapter.observeResponses((r) => responses.push(r));

        await vi.advanceTimersByTimeAsync(2000);

        expect(responses).toEqual([]);
      } finally {
        vi.useRealTimers();
      }
    });

    it('skips past an intermediate assistant sub-turn (e.g. a tool-use/reasoning step) to find the real preceding user turn', async () => {
      // Confirmed live on chatgpt.com: a single logical reply can render as
      // several consecutive conversation-turn-N elements all tagged
      // role="assistant" (an intermediate step, then the final answer), not
      // a strict user/assistant alternation. The intermediate one here has
      // no real text (like a bare tool-status turn), so it never fires.
      vi.useFakeTimers();
      try {
        const adapter = buildAdapter(
          `<main>
             <div data-testid="conversation-turn-1">
               <div data-message-author-role="user">What's the weather in Paris?</div>
             </div>
             <div data-testid="conversation-turn-2">
               <div data-message-author-role="assistant"></div>
             </div>
             <div data-testid="conversation-turn-3">
               <div data-message-author-role="assistant"></div>
             </div>
           </main>`,
        );
        const finalReplyEl = adapter['doc'].querySelector(
          '[data-testid="conversation-turn-3"] [data-message-author-role="assistant"]',
        ) as HTMLElement;

        const responses: unknown[] = [];
        const stop = adapter.observeResponses((r) => responses.push(r));

        finalReplyEl.textContent = "It's sunny, 22°C.";
        await vi.advanceTimersByTimeAsync(900);

        expect(responses).toEqual([{ promptText: "What's the weather in Paris?", responseText: "It's sunny, 22°C." }]);
        stop();
      } finally {
        vi.useRealTimers();
      }
    });

    it('finds the preceding user turn even when turns are not direct DOM siblings (each wrapped separately)', async () => {
      // Confirmed live on chatgpt.com: turn.previousElementSibling is null
      // even for a turn with real predecessors - each conversation-turn-N
      // sits inside its own wrapper rather than being a direct sibling of
      // the others. Matching prompts/replies must work by document order
      // (querySelectorAll), not by walking the DOM sibling chain.
      vi.useFakeTimers();
      try {
        const adapter = buildAdapter(
          `<main>
             <div class="row"><div data-testid="conversation-turn-1">
               <div data-message-author-role="user">What's the weather in Paris?</div>
             </div></div>
             <div class="row"><div data-testid="conversation-turn-2">
               <div data-message-author-role="assistant">It's sunny, 22°C.</div>
             </div></div>
           </main>`,
        );
        const responses: unknown[] = [];
        const stop = adapter.observeResponses((r) => responses.push(r));

        const replyEl = adapter['doc'].querySelector(
          '[data-testid="conversation-turn-2"] [data-message-author-role="assistant"]',
        ) as HTMLElement;
        replyEl.textContent = "It's sunny, 22°C. (updated)";
        await vi.advanceTimersByTimeAsync(900);

        expect(responses).toEqual([
          { promptText: "What's the weather in Paris?", responseText: "It's sunny, 22°C. (updated)" },
        ]);
        stop();
      } finally {
        vi.useRealTimers();
      }
    });

    it('does not crash or emit a bogus response when data-message-author-role is entirely missing (selector drift)', async () => {
      // Text extraction depends on the same attribute as role detection, so
      // this can't isolate "parity fallback picked the right turn" from
      // "extraction found no text either way" - it only guards against a
      // crash or a false-positive emission when the primary selector is gone.
      vi.useFakeTimers();
      try {
        const adapter = buildAdapter(
          `<main>
             <div data-testid="conversation-turn-1">Hi</div>
             <div data-testid="conversation-turn-2"></div>
           </main>`,
        );
        const container = adapter['doc'].querySelector('main') as HTMLElement;
        const secondTurn = container.children[1] as HTMLElement;

        const responses: unknown[] = [];
        const stop = adapter.observeResponses((r) => responses.push(r));

        expect(() => {
          secondTurn.textContent = 'Hello!';
        }).not.toThrow();
        await vi.advanceTimersByTimeAsync(900);

        expect(responses).toEqual([]);
        stop();
      } finally {
        vi.useRealTimers();
      }
    });
  });
});
