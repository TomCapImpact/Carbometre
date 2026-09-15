import type { Confirmation, ConfirmationRequest } from './Confirmation.js';

const BACKDROP_CLASS = 'carbometre-modal-backdrop';
const MODAL_CLASS = 'carbometre-modal';
const FOCUSABLE_SELECTOR = 'button, a[href], [tabindex]:not([tabindex="-1"])';

/**
 * A small modal built by hand rather than <dialog>.showModal(): the native
 * element is not implemented in the test DOM, and window.confirm() shows
 * the host site's name as its title and cannot be styled. Focus is trapped
 * inside, Escape and a backdrop click both cancel, and clicks never reach
 * the document - so a dashboard listening for "click outside" stays open
 * underneath.
 */
export class ModalConfirmation implements Confirmation {
  constructor(private readonly doc: Document) {}

  ask(request: ConfirmationRequest): Promise<boolean> {
    return new Promise((resolve) => {
      const previouslyFocused = this.doc.activeElement as HTMLElement | null;

      const backdrop = this.doc.createElement('div');
      backdrop.className = BACKDROP_CLASS;

      const modal = this.doc.createElement('div');
      modal.className = MODAL_CLASS;
      modal.role = 'alertdialog';
      modal.setAttribute('aria-modal', 'true');

      const title = this.doc.createElement('h2');
      title.className = `${MODAL_CLASS}-title`;
      title.id = `${MODAL_CLASS}-title`;
      title.textContent = request.title;
      modal.setAttribute('aria-labelledby', title.id);

      const message = this.doc.createElement('p');
      message.className = `${MODAL_CLASS}-message`;
      message.id = `${MODAL_CLASS}-message`;
      message.textContent = request.message;
      modal.setAttribute('aria-describedby', message.id);

      const actions = this.doc.createElement('div');
      actions.className = `${MODAL_CLASS}-actions`;
      const cancelButton = this.buildButton(request.cancelLabel, `${MODAL_CLASS}-cancel`);
      const confirmButton = this.buildButton(request.confirmLabel, `${MODAL_CLASS}-confirm`);
      actions.append(cancelButton, confirmButton);

      modal.append(title, message, actions);
      backdrop.append(modal);

      const finish = (answer: boolean): void => {
        backdrop.remove();
        previouslyFocused?.focus();
        resolve(answer);
      };

      confirmButton.addEventListener('click', () => finish(true));
      cancelButton.addEventListener('click', () => finish(false));
      backdrop.addEventListener('click', (event) => {
        event.stopPropagation();
        if (event.target === backdrop) {
          finish(false);
        }
      });
      backdrop.addEventListener('keydown', (event) => {
        event.stopPropagation();
        if (event.key === 'Escape') {
          event.preventDefault();
          finish(false);
          return;
        }
        if (event.key === 'Tab') {
          this.trapTab(event, modal);
        }
      });

      this.doc.body.append(backdrop);
      confirmButton.focus();
    });
  }

  private buildButton(label: string, className: string): HTMLButtonElement {
    const button = this.doc.createElement('button');
    button.type = 'button';
    button.className = className;
    button.textContent = label;
    return button;
  }

  private trapTab(event: KeyboardEvent, modal: HTMLElement): void {
    const focusable = Array.from(modal.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (!first || !last) {
      return;
    }
    if (event.shiftKey && this.doc.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && this.doc.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }
}
