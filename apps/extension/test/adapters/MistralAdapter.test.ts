import { JSDOM } from 'jsdom';
import { describe, expect, it, vi } from 'vitest';
import { MistralAdapter } from '../../src/adapters/MistralAdapter.js';

function buildAdapter(html: string, url = 'https://chat.mistral.ai/work/2089030e-15da-4c5d-b8d8-4d882f86f3b8'): MistralAdapter {
  const dom = new JSDOM(html, { url });
  return new MistralAdapter(dom.window.document);
}

describe('MistralAdapter', () => {
  describe('currentConversationId', () => {
    it('extracts the uuid from a /work/<uuid> URL (the shape confirmed live)', () => {
      const adapter = buildAdapter('<html></html>', 'https://chat.mistral.ai/work/2089030e-15da-4c5d-b8d8-4d882f86f3b8');
      expect(adapter.currentConversationId()).toBe('2089030e-15da-4c5d-b8d8-4d882f86f3b8');
    });

    it('accepts the uuid under any section prefix, rather than pinning "work"', () => {
      const adapter = buildAdapter('<html></html>', 'https://chat.mistral.ai/chat/2089030e-15da-4c5d-b8d8-4d882f86f3b8');
      expect(adapter.currentConversationId()).toBe('2089030e-15da-4c5d-b8d8-4d882f86f3b8');
    });

    it('returns null off a conversation page', () => {
      expect(buildAdapter('<html></html>', 'https://chat.mistral.ai/').currentConversationId()).toBeNull();
    });
  });

  describe('detectModelId', () => {
    it('maps "Ministral"/"Small" to mistral-small before the broader mistral pattern', () => {
      expect(buildAdapter('<button>Ministral 3B</button>').detectModelId()).toBe('mistral-small');
      expect(buildAdapter('<button>Mistral Small</button>').detectModelId()).toBe('mistral-small');
    });

    it('maps "Large"/"Magistral" to mistral-frontier', () => {
      expect(buildAdapter('<button>Mistral Large</button>').detectModelId()).toBe('mistral-frontier');
      expect(buildAdapter('<button>Magistral</button>').detectModelId()).toBe('mistral-frontier');
    });

    it('maps a plain "Mistral"/"Medium" label to mistral-mid', () => {
      expect(buildAdapter('<button>Mistral Medium</button>').detectModelId()).toBe('mistral-mid');
    });

    it('returns null when nothing looks like a model label', () => {
      expect(buildAdapter('<html></html>').detectModelId()).toBeNull();
      expect(buildAdapter('<button>Mystery Model</button>').detectModelId()).toBeNull();
    });

    it('ignores long prose buttons that merely mention a model name', () => {
      const adapter = buildAdapter('<button>Ask Mistral Large to rewrite this paragraph for you now</button>');
      expect(adapter.detectModelId()).toBeNull();
    });
  });

  describe('fallbackModel', () => {
    it('falls back to the mid tier, since Mistral has no >200B frontier model in the catalog', () => {
      expect(buildAdapter('<html></html>').fallbackModel()).toEqual({ providerId: 'mistral', tier: 'mid' });
    });
  });

  describe('observeResponses', () => {
    it('reports a finished exchange once the assistant turn stops mutating for 800ms', async () => {
      vi.useFakeTimers();
      try {
        const adapter = buildAdapter(
          `<main>
             <div data-message-id="m1">
               <div data-message-author-role="user">Capitale de la France ?</div>
             </div>
             <div data-message-id="m2">
               <div data-message-author-role="assistant"></div>
             </div>
           </main>`,
        );
        const replyEl = adapter['doc'].querySelector('[data-message-author-role="assistant"]') as HTMLElement;

        const responses: unknown[] = [];
        const stop = adapter.observeResponses((r) => responses.push(r));

        replyEl.textContent = 'Paris.';
        await vi.advanceTimersByTimeAsync(900);

        expect(responses).toEqual([{ promptText: 'Capitale de la France ?', responseText: 'Paris.' }]);
        stop();
      } finally {
        vi.useRealTimers();
      }
    });

    it('matches prompt to reply by document order when turns are not DOM siblings', async () => {
      vi.useFakeTimers();
      try {
        const adapter = buildAdapter(
          `<main>
             <div class="row"><div data-message-id="m1">
               <div data-message-author-role="user">Bonjour</div>
             </div></div>
             <div class="row"><div data-message-id="m2">
               <div data-message-author-role="assistant"></div>
             </div></div>
           </main>`,
        );
        const replyEl = adapter['doc'].querySelector('[data-message-author-role="assistant"]') as HTMLElement;

        const responses: unknown[] = [];
        const stop = adapter.observeResponses((r) => responses.push(r));

        replyEl.textContent = 'Bonjour ! Comment puis-je aider ?';
        await vi.advanceTimersByTimeAsync(900);

        expect(responses).toEqual([{ promptText: 'Bonjour', responseText: 'Bonjour ! Comment puis-je aider ?' }]);
        stop();
      } finally {
        vi.useRealTimers();
      }
    });

    it('prefers the narrower prose/markdown content over the whole role holder', async () => {
      vi.useFakeTimers();
      try {
        const adapter = buildAdapter(
          `<main>
             <div data-message-id="m1">
               <div data-message-author-role="user">Salut</div>
             </div>
             <div data-message-id="m2">
               <div data-message-author-role="assistant">
                 <div class="prose"></div>
                 <button>Copier</button>
               </div>
             </div>
           </main>`,
        );
        const proseEl = adapter['doc'].querySelector('.prose') as HTMLElement;

        const responses: unknown[] = [];
        const stop = adapter.observeResponses((r) => responses.push(r));

        proseEl.textContent = 'Salut !';
        await vi.advanceTimersByTimeAsync(900);

        expect(responses).toEqual([{ promptText: 'Salut', responseText: 'Salut !' }]);
        stop();
      } finally {
        vi.useRealTimers();
      }
    });

    it('handles the real Le Chat shape: role attribute on the turn itself, body in .select-text, chrome excluded', async () => {
      // Mirrors the structure captured live on 2026-09-13: the turn element
      // carries BOTH data-message-id and data-message-author-role (so a
      // descendant-only lookup finds nothing), the text sits several levels
      // down in .select-text, and the turn also contains action-button text
      // that must not be counted as part of the message.
      vi.useFakeTimers();
      try {
        const adapter = buildAdapter(
          `<div data-testid="conversation-layout">
             <div class="flex w-full justify-center"><div class="w-full max-w-md">
               <div id="u1" data-message-author-role="user" data-message-id="u1" class="group/message">
                 <div class="flex flex-col"><div class="select-none"><div class="select-text">
                   <span class="whitespace-pre-wrap">CARBOTEST123</span>
                 </div></div></div>
                 <button>Modifier</button>
               </div>
             </div></div>
             <div class="flex w-full justify-center"><div class="w-full max-w-md">
               <div id="a1" data-message-author-role="assistant" data-message-id="a1" class="group/message">
                 <div class="flex flex-col"><div class="select-text"></div></div>
                 <button>Copier</button>
               </div>
             </div></div>
           </div>`,
        );
        const replyBody = adapter['doc'].querySelector('#a1 .select-text') as HTMLElement;

        const responses: unknown[] = [];
        const stop = adapter.observeResponses((r) => responses.push(r));

        replyBody.textContent = 'Paris est la capitale.';
        await vi.advanceTimersByTimeAsync(900);

        // "Modifier"/"Copier" must not leak into either side of the exchange.
        expect(responses).toEqual([{ promptText: 'CARBOTEST123', responseText: 'Paris est la capitale.' }]);
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
             <div data-message-id="m1"><div data-message-author-role="user">Salut</div></div>
             <div data-message-id="m2"><div data-message-author-role="assistant">Salut !</div></div>
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
  });
});
