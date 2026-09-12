import { JSDOM } from 'jsdom';
import { describe, expect, it, vi } from 'vitest';
import { ClaudeAdapter } from '../../src/adapters/ClaudeAdapter.js';

function buildAdapter(html: string, url = 'https://claude.ai/chat/abc-123'): ClaudeAdapter {
  const dom = new JSDOM(html, { url });
  return new ClaudeAdapter(dom.window.document);
}

describe('ClaudeAdapter', () => {
  describe('currentConversationId', () => {
    it('extracts the id from a /chat/<id> URL', () => {
      const adapter = buildAdapter('<html></html>', 'https://claude.ai/chat/9f8e7d6c-1234');
      expect(adapter.currentConversationId()).toBe('9f8e7d6c-1234');
    });

    it('returns null off a conversation page', () => {
      const adapter = buildAdapter('<html></html>', 'https://claude.ai/new');
      expect(adapter.currentConversationId()).toBeNull();
    });
  });

  describe('detectModelId', () => {
    it('maps a visible "Opus" label to claude-frontier', () => {
      const adapter = buildAdapter(
        '<button data-testid="model-selector-dropdown"><span class="truncate">Opus 5<span> High</span></span></button>',
      );
      expect(adapter.detectModelId()).toBe('claude-frontier');
    });

    it('maps a visible "Sonnet" label to claude-mid', () => {
      const adapter = buildAdapter('<button data-testid="model-selector-dropdown">Sonnet 5</button>');
      expect(adapter.detectModelId()).toBe('claude-mid');
    });

    it('maps a visible "Haiku" label to claude-small', () => {
      const adapter = buildAdapter('<button data-testid="model-selector-dropdown">Haiku 4.5</button>');
      expect(adapter.detectModelId()).toBe('claude-small');
    });

    it('returns null when the model picker is missing or unrecognized', () => {
      expect(buildAdapter('<html></html>').detectModelId()).toBeNull();
      expect(buildAdapter('<button data-testid="model-selector-dropdown">Mystery Model</button>').detectModelId()).toBeNull();
    });
  });

  describe('badgeAnchor', () => {
    it('finds the Share button, the actual rightmost header control', () => {
      const adapter = buildAdapter('<button data-testid="wiggle-controls-actions-share">Share</button>');
      expect(adapter.badgeAnchor()?.getAttribute('data-testid')).toBe('wiggle-controls-actions-share');
    });

    it('returns null when the header has not rendered yet', () => {
      expect(buildAdapter('<html></html>').badgeAnchor()).toBeNull();
    });
  });

  describe('observeResponses', () => {
    it('reports a finished exchange once its assistant turn stops mutating for 800ms', async () => {
      vi.useFakeTimers();
      try {
        const adapter = buildAdapter(
          `<div data-testid="transcript-list">
             <div data-testid="transcript-row" data-perf-row="human" data-perf-row-streaming="false">
               <div data-testid="user-message">What is the capital of France?</div>
             </div>
             <div data-testid="transcript-row" data-perf-row="assistant" data-perf-row-streaming="false">
               <div data-perf-reply-text=""></div>
             </div>
           </div>`,
        );
        const replyTextEl = adapter['doc'].querySelector('[data-perf-reply-text]') as HTMLElement;

        const responses: unknown[] = [];
        const stop = adapter.observeResponses((r) => responses.push(r));

        replyTextEl.textContent = 'Paris.';
        await vi.advanceTimersByTimeAsync(900);

        expect(responses).toEqual([{ promptText: 'What is the capital of France?', responseText: 'Paris.' }]);
        stop();
      } finally {
        vi.useRealTimers();
      }
    });

    it('does not report turns that were already in the DOM before observing started', async () => {
      vi.useFakeTimers();
      try {
        const adapter = buildAdapter(
          `<div data-testid="transcript-list">
             <div data-testid="transcript-row" data-perf-row="human" data-perf-row-streaming="false">
               <div data-testid="user-message">Hi</div>
             </div>
             <div data-testid="transcript-row" data-perf-row="assistant" data-perf-row-streaming="false">
               <div data-perf-reply-text="">Hello!</div>
             </div>
           </div>`,
        );
        const responses: unknown[] = [];
        adapter.observeResponses((r) => responses.push(r));

        await vi.advanceTimersByTimeAsync(2000);

        expect(responses).toEqual([]);
      } finally {
        vi.useRealTimers();
      }
    });

    it('separates a visible thinking block (a sibling of the reply, not nested in it) from the counted response text', async () => {
      vi.useFakeTimers();
      try {
        const adapter = buildAdapter(
          `<div data-testid="transcript-list">
             <div data-testid="transcript-row" data-perf-row="human" data-perf-row-streaming="false">
               <div data-testid="user-message">Why is the sky blue?</div>
             </div>
             <div data-testid="transcript-row" data-perf-row="assistant" data-perf-row-streaming="false">
               <div data-testid="thinking-block">Rayleigh scattering favors shorter wavelengths...</div>
               <div data-perf-reply-text=""></div>
             </div>
           </div>`,
        );
        const responses: unknown[] = [];
        const stop = adapter.observeResponses((r) => responses.push(r));

        const replyTextEl = adapter['doc'].querySelector('[data-perf-reply-text]') as HTMLElement;
        replyTextEl.textContent = "It's due to Rayleigh scattering.";

        await vi.advanceTimersByTimeAsync(900);

        expect(responses).toEqual([
          {
            promptText: 'Why is the sky blue?',
            responseText: "It's due to Rayleigh scattering.",
            visibleThinkingText: 'Rayleigh scattering favors shorter wavelengths...',
          },
        ]);
        stop();
      } finally {
        vi.useRealTimers();
      }
    });

    it('waits for data-perf-row-streaming to clear before counting a response, even after 800ms of quiet', async () => {
      vi.useFakeTimers();
      try {
        const adapter = buildAdapter(
          `<div data-testid="transcript-list">
             <div data-testid="transcript-row" data-perf-row="human" data-perf-row-streaming="false">
               <div data-testid="user-message">Tell me a story.</div>
             </div>
             <div data-testid="transcript-row" data-perf-row="assistant" data-perf-row-streaming="true">
               <div data-perf-reply-text="">Once upon a time</div>
             </div>
           </div>`,
        );
        const container = adapter['doc'].querySelector('[data-testid="transcript-list"]') as HTMLElement;
        const assistantTurn = container.querySelector('[data-perf-row="assistant"]') as HTMLElement;
        const replyTextEl = assistantTurn.querySelector('[data-perf-reply-text]') as HTMLElement;

        const responses: unknown[] = [];
        const stop = adapter.observeResponses((r) => responses.push(r));

        replyTextEl.textContent = 'Once upon a time, paused mid-tool-call';
        await vi.advanceTimersByTimeAsync(900);
        expect(responses).toEqual([]); // still marked streaming, even though content went quiet

        assistantTurn.setAttribute('data-perf-row-streaming', 'false');
        replyTextEl.textContent = 'Once upon a time, paused mid-tool-call, then finished.';
        await vi.advanceTimersByTimeAsync(900);

        expect(responses).toEqual([
          {
            promptText: 'Tell me a story.',
            responseText: 'Once upon a time, paused mid-tool-call, then finished.',
          },
        ]);
        stop();
      } finally {
        vi.useRealTimers();
      }
    });
  });
});
