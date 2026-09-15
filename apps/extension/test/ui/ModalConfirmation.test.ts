import { beforeEach, describe, expect, it } from 'vitest';
import { ModalConfirmation } from '../../src/ui/ModalConfirmation.js';

const REQUEST = { title: 'Title', message: 'Body text', confirmLabel: 'Yes', cancelLabel: 'No' };

describe('ModalConfirmation', () => {
  beforeEach(() => {
    document.body.innerHTML = '<button id="origin">origin</button>';
  });

  it('renders an accessible alertdialog, focuses confirm, and resolves true on confirm', async () => {
    const origin = document.getElementById('origin') as HTMLButtonElement;
    origin.focus();
    const answer = new ModalConfirmation(document).ask(REQUEST);

    const modal = document.querySelector('.carbometre-modal') as HTMLElement;
    expect(modal.getAttribute('role')).toBe('alertdialog');
    expect(modal.getAttribute('aria-modal')).toBe('true');
    expect(document.getElementById(modal.getAttribute('aria-labelledby')!)?.textContent).toBe('Title');
    expect(document.getElementById(modal.getAttribute('aria-describedby')!)?.textContent).toBe('Body text');
    const confirm = modal.querySelector('.carbometre-modal-confirm') as HTMLButtonElement;
    expect(document.activeElement).toBe(confirm);

    confirm.click();
    expect(await answer).toBe(true);
    expect(document.querySelector('.carbometre-modal-backdrop')).toBeNull();
    expect(document.activeElement).toBe(origin); // focus restored
  });

  it('resolves false on cancel, on Escape, and on a backdrop click', async () => {
    const confirmation = new ModalConfirmation(document);

    const byCancel = confirmation.ask(REQUEST);
    (document.querySelector('.carbometre-modal-cancel') as HTMLButtonElement).click();
    expect(await byCancel).toBe(false);

    const byEscape = confirmation.ask(REQUEST);
    document
      .querySelector('.carbometre-modal-backdrop')!
      .dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(await byEscape).toBe(false);

    const byBackdrop = confirmation.ask(REQUEST);
    (document.querySelector('.carbometre-modal-backdrop') as HTMLElement).click();
    expect(await byBackdrop).toBe(false);
    expect(document.querySelector('.carbometre-modal-backdrop')).toBeNull();
  });

  it('does not let clicks inside it reach the document (so a "click outside to close" panel stays open)', async () => {
    let reachedDocument = 0;
    const listener = (): void => {
      reachedDocument += 1;
    };
    document.addEventListener('click', listener);
    try {
      const answer = new ModalConfirmation(document).ask(REQUEST);
      (document.querySelector('.carbometre-modal-message') as HTMLElement).click();
      (document.querySelector('.carbometre-modal-confirm') as HTMLButtonElement).click();
      await answer;
      expect(reachedDocument).toBe(0);
    } finally {
      document.removeEventListener('click', listener);
    }
  });

  it('traps Tab between cancel and confirm', () => {
    new ModalConfirmation(document).ask(REQUEST);
    const backdrop = document.querySelector('.carbometre-modal-backdrop') as HTMLElement;
    const cancel = document.querySelector('.carbometre-modal-cancel') as HTMLButtonElement;
    const confirm = document.querySelector('.carbometre-modal-confirm') as HTMLButtonElement;

    confirm.focus();
    const forward = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
    backdrop.dispatchEvent(forward);
    expect(forward.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(cancel);

    const backward = new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true, cancelable: true });
    backdrop.dispatchEvent(backward);
    expect(backward.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(confirm);
  });
});
