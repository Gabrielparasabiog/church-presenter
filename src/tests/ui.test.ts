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

  it('generates slides, supports click/tap zones, and isolates presentation mode', () => {
    const root = setupDocument();
    const cleanup = renderLyricsPage(root);
    const source = document.querySelector<HTMLTextAreaElement>('#lyrics-source')!;
    source.value = 'Line one\nLine two\n\nLine three';
    document.querySelector<HTMLButtonElement>('#generate-slides')!.click();

    expect(document.querySelectorAll('.thumbnail')).toHaveLength(2);
    expect(document.querySelector('#slide-position')?.textContent).toBe('Slide 1 of 2');
    expect(document.querySelectorAll('#editor-slide-copy span')).toHaveLength(2);

    document.querySelector<HTMLButtonElement>('#present-deck')!.click();
    expect(document.body.classList.contains('is-presenting')).toBe(true);
    expect(document.querySelector<HTMLElement>('#presentation-overlay')!.hidden).toBe(false);
    expect(document.querySelector('#presentation-counter')?.textContent).toBe('1 / 2');

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
