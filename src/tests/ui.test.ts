import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DECK_STORAGE_KEY, TIMER_STORAGE_KEY } from '../core/storage';
import { renderLyricsPage } from '../ui/lyricsPage';
import { renderTimerPage } from '../ui/timerPage';

const setupDocument = (): HTMLElement => {
  document.body.innerHTML = '<div id="root"></div>';
  Object.defineProperty(document, 'fonts', {
    configurable: true,
    value: { ready: Promise.resolve() },
  });
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    callback(0);
    return 1;
  });
  return document.querySelector<HTMLElement>('#root')!;
};

describe('accessible interactive views', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    document.body.className = '';
    document.body.innerHTML = '';
  });

  it('exposes labeled timer fields and autosaves duration and theme changes', () => {
    const root = setupDocument();
    const cleanup = renderTimerPage(root);
    const minutes = document.querySelector<HTMLInputElement>('#timer-minutes')!;
    const seconds = document.querySelector<HTMLInputElement>('#timer-seconds')!;
    const theme = document.querySelector<HTMLSelectElement>('#timer-theme')!;

    expect(document.querySelector('label[for="timer-theme"]')?.textContent).toContain('Screen background');
    expect(minutes.closest('label')?.textContent).toContain('Minutes');
    minutes.value = '4';
    seconds.value = '30';
    seconds.dispatchEvent(new Event('change', { bubbles: true }));
    theme.value = 'white';
    theme.dispatchEvent(new Event('change', { bubbles: true }));

    expect(JSON.parse(localStorage.getItem(TIMER_STORAGE_KEY)!)).toMatchObject({
      durationMs: 270_000,
      theme: 'white',
    });
    cleanup();
  });

  it('supports projector keyboard shortcuts without hijacking duration fields', () => {
    const root = setupDocument();
    const cleanup = renderTimerPage(root);
    const seconds = document.querySelector<HTMLInputElement>('#timer-seconds')!;
    const primary = document.querySelector<HTMLButtonElement>('#timer-primary')!;

    seconds.focus();
    seconds.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
    expect(primary.textContent).toBe('Start countdown');

    document.body.focus();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
    expect(primary.textContent).toBe('Pause');
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'r', bubbles: true }));
    expect(primary.textContent).toBe('Start countdown');
    cleanup();
  });

  it('generates slides, supports click/tap zones, and isolates presentation mode', () => {
    const root = setupDocument();
    const cleanup = renderLyricsPage(root);
    const source = document.querySelector<HTMLTextAreaElement>('#lyrics-source')!;
    source.value = 'Line one\nLine two\n\nLine three';
    document.querySelector<HTMLButtonElement>('#generate-slides')!.click();

    expect(document.querySelectorAll('.thumbnail')).toHaveLength(2);
    expect(document.querySelector('#slide-position')?.textContent).toBe('Slide 1 of 2');
    expect(document.querySelectorAll('#editor-slide-copy span')).toHaveLength(2);
    expect(document.querySelectorAll('#editor-slide-copy span')[0]?.textContent).toBe('Line one');
    expect(document.querySelectorAll('#editor-slide-copy span')[1]?.textContent).toBe('Line two');

    document.querySelector<HTMLButtonElement>('#present-deck')!.click();
    expect(document.body.classList.contains('is-presenting')).toBe(true);
    expect(document.querySelector<HTMLElement>('#presentation-overlay')!.hidden).toBe(false);
    expect(document.querySelector('#presentation-counter')?.textContent).toBe('1 / 2');
    expect(document.activeElement?.id).toBe('presentation-stage');

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'b', bubbles: true }));
    expect(document.querySelector('#presentation-stage')?.classList.contains('is-blank')).toBe(true);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'b', bubbles: true }));
    expect(document.querySelector('#presentation-stage')?.classList.contains('is-blank')).toBe(false);

    document.querySelector<HTMLButtonElement>('#presentation-next')!.click();
    expect(document.querySelector('#presentation-counter')?.textContent).toBe('2 / 2');
    document.querySelector<HTMLButtonElement>('#presentation-next')!.click();
    expect(document.querySelector('#presentation-counter')?.textContent).toBe('2 / 2');
    document.querySelector<HTMLButtonElement>('#presentation-previous')!.click();
    expect(document.querySelector('#presentation-counter')?.textContent).toBe('1 / 2');

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }));
    expect(document.querySelector('#presentation-counter')?.textContent).toBe('2 / 2');
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(document.querySelector<HTMLElement>('#presentation-overlay')!.hidden).toBe(true);
    expect(document.body.classList.contains('is-presenting')).toBe(false);
    expect(JSON.parse(localStorage.getItem(DECK_STORAGE_KEY)!).slides).toHaveLength(2);
    cleanup();
  });

  it('navigates slides when the editor page has focus without intercepting form controls', () => {
    const root = setupDocument();
    const cleanup = renderLyricsPage(root);
    const source = document.querySelector<HTMLTextAreaElement>('#lyrics-source')!;
    source.value = 'First line\nSecond line\nThird line\nFourth line';
    document.querySelector<HTMLButtonElement>('#generate-slides')!.click();

    const pageArrow = new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true });
    document.body.dispatchEvent(pageArrow);
    expect(pageArrow.defaultPrevented).toBe(true);
    expect(document.querySelector('#slide-position')?.textContent).toBe('Slide 2 of 2');
    expect(document.querySelector('#editor-slide-copy')?.textContent).toContain('Third line');

    const textFieldArrow = new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true, cancelable: true });
    source.dispatchEvent(textFieldArrow);
    expect(textFieldArrow.defaultPrevented).toBe(false);
    expect(document.querySelector('#slide-position')?.textContent).toBe('Slide 2 of 2');
    cleanup();
  });

  it('navigates editor slides with arrow keys and leaves text fields alone', () => {
    const root = setupDocument();
    const cleanup = renderLyricsPage(root);
    const source = document.querySelector<HTMLTextAreaElement>('#lyrics-source')!;
    source.value = 'Line one\nLine two\nLine three\nLine four\nLine five\nLine six';
    document.querySelector<HTMLButtonElement>('#generate-slides')!.click();
    const originalSlides = JSON.parse(localStorage.getItem(DECK_STORAGE_KEY)!).slides;

    const originalScrollIntoView = HTMLElement.prototype.scrollIntoView;
    const scrollIntoView = vi.fn();
    HTMLElement.prototype.scrollIntoView = scrollIntoView;
    try {
      const canvas = document.querySelector<HTMLElement>('#editor-canvas')!;
      canvas.focus();
      const canvasArrow = new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true });
      canvas.dispatchEvent(canvasArrow);

      expect(canvasArrow.defaultPrevented).toBe(true);
      expect(document.querySelector('#slide-position')?.textContent).toBe('Slide 2 of 3');
      expect(document.querySelector('#editor-slide-copy')?.textContent).toContain('Line three');
      expect(document.querySelector<HTMLTextAreaElement>('#slide-line-one')?.value).toBe('Line three');
      expect(document.querySelectorAll<HTMLButtonElement>('.thumbnail')[1]?.getAttribute('aria-selected')).toBe('true');
      expect(scrollIntoView).toHaveBeenCalledWith({ block: 'nearest', inline: 'nearest' });

      const selectedThumbnail = document.querySelector<HTMLButtonElement>('.thumbnail[aria-selected="true"]')!;
      selectedThumbnail.focus();
      selectedThumbnail.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }));
      expect(document.querySelector('#slide-position')?.textContent).toBe('Slide 3 of 3');
      expect(document.activeElement).toBe(document.querySelector('.thumbnail[aria-selected="true"]'));

      const lastThumbnail = document.querySelector<HTMLButtonElement>('.thumbnail[aria-selected="true"]')!;
      const boundaryArrow = new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true });
      lastThumbnail.dispatchEvent(boundaryArrow);
      expect(boundaryArrow.defaultPrevented).toBe(true);
      expect(document.querySelector('#slide-position')?.textContent).toBe('Slide 3 of 3');

      const previousThumbnail = document.querySelector<HTMLButtonElement>('.thumbnail[aria-selected="true"]')!;
      previousThumbnail.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true, cancelable: true }));
      expect(document.querySelector('#slide-position')?.textContent).toBe('Slide 2 of 3');
      canvas.focus();
      const firstSlideArrow = new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true, cancelable: true });
      canvas.dispatchEvent(firstSlideArrow);
      expect(firstSlideArrow.defaultPrevented).toBe(true);
      expect(document.querySelector('#slide-position')?.textContent).toBe('Slide 1 of 3');
      const firstBoundaryArrow = new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true, cancelable: true });
      canvas.dispatchEvent(firstBoundaryArrow);
      expect(firstBoundaryArrow.defaultPrevented).toBe(true);
      expect(document.querySelector('#slide-position')?.textContent).toBe('Slide 1 of 3');
      expect(JSON.parse(localStorage.getItem(DECK_STORAGE_KEY)!).slides).toEqual(originalSlides);

      const slideText = document.querySelector<HTMLTextAreaElement>('#slide-line-one')!;
      slideText.focus();
      const typingArrow = new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true, cancelable: true });
      slideText.dispatchEvent(typingArrow);
      expect(typingArrow.defaultPrevented).toBe(false);
      expect(document.querySelector('#slide-position')?.textContent).toBe('Slide 1 of 3');

      source.focus();
      const sourceArrow = new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true });
      source.dispatchEvent(sourceArrow);
      expect(sourceArrow.defaultPrevented).toBe(false);
      expect(document.querySelector('#slide-position')?.textContent).toBe('Slide 1 of 3');

      const deckTitle = document.querySelector<HTMLInputElement>('#deck-title')!;
      deckTitle.focus();
      const titleArrow = new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true, cancelable: true });
      deckTitle.dispatchEvent(titleArrow);
      expect(titleArrow.defaultPrevented).toBe(false);
      expect(document.querySelector('#slide-position')?.textContent).toBe('Slide 1 of 3');
    } finally {
      HTMLElement.prototype.scrollIntoView = originalScrollIntoView;
      cleanup();
    }
  });

  it('restores the saved deck and selected position on a new render', () => {
    const root = setupDocument();
    const cleanupFirst = renderLyricsPage(root);
    const source = document.querySelector<HTMLTextAreaElement>('#lyrics-source')!;
    source.value = 'A\nB\nC\nD';
    document.querySelector<HTMLButtonElement>('#generate-slides')!.click();
    document.querySelectorAll<HTMLButtonElement>('.thumbnail')[1]!.click();
    cleanupFirst();

    const cleanupSecond = renderLyricsPage(root);
    expect(document.querySelector('#slide-position')?.textContent).toBe('Slide 2 of 2');
    expect(document.querySelector('#editor-slide-copy')?.textContent).toContain('C');
    cleanupSecond();
  });
});
