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
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
    font: '',
    measureText: (text: string) => ({ width: text.length * 10 }),
  } as unknown as CanvasRenderingContext2D);
  return document.querySelector<HTMLElement>('#root')!;
};

describe('accessible interactive views', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
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

  it('catches the timer up immediately when a hidden tab becomes visible', () => {
    const root = setupDocument();
    const cleanup = renderTimerPage(root);
    const minutes = document.querySelector<HTMLInputElement>('#timer-minutes')!;
    const seconds = document.querySelector<HTMLInputElement>('#timer-seconds')!;
    minutes.value = '0';
    seconds.value = '2';
    seconds.dispatchEvent(new Event('change', { bubbles: true }));
    document.querySelector<HTMLButtonElement>('#timer-primary')!.click();

    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
    vi.setSystemTime(Date.now() + 3_000);
    document.dispatchEvent(new Event('visibilitychange'));
    expect(document.querySelector('#timer-state-label')?.textContent).toBe('Countdown in progress');

    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
    document.dispatchEvent(new Event('visibilitychange'));
    expect(document.querySelector('#timer-output')?.textContent).toBe('00:00');
    expect(document.querySelector('#timer-state-label')?.textContent).toBe('Time complete');
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
    expect(document.querySelectorAll('#editor-view-previews [data-preview-view]')).toHaveLength(4);
    const blackWhitePreview = document.querySelectorAll('#editor-view-previews [data-preview-view="black-white"] .view-preview-copy span');
    expect(blackWhitePreview).toHaveLength(2);
    expect(blackWhitePreview[0]?.textContent).toBe('Line one');
    expect(blackWhitePreview[1]?.textContent).toBe('Line two');
    expect(document.querySelector('#editor-view-previews [data-preview-view="custom-color"] .view-preview-copy')?.textContent).toContain('Line one');

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

  it('offers four lyric views, per-slide overrides, custom contrast, and ten church backgrounds', () => {
    const root = setupDocument();
    const cleanup = renderLyricsPage(root);
    const deckViews = document.querySelector<HTMLDivElement>('#deck-view-options')!;
    expect(deckViews.querySelectorAll('[data-view]')).toHaveLength(4);
    deckViews.querySelector<HTMLButtonElement>('[data-view="black-white"]')!.click();

    const source = document.querySelector<HTMLTextAreaElement>('#lyrics-source')!;
    source.value = 'First line\nSecond line';
    document.querySelector<HTMLButtonElement>('#generate-slides')!.click();
    expect(document.querySelector('#editor-view-previews [data-preview-view="black-white"]')?.classList.contains('lyric-view-black-white')).toBe(true);
    const stageViews = document.querySelector<HTMLDivElement>('#stage-view-options')!;
    expect(stageViews.querySelectorAll('[data-view]')).toHaveLength(4);
    expect(stageViews.querySelector('[data-view="black-white"]')?.getAttribute('aria-pressed')).toBe('true');
    stageViews.querySelector<HTMLButtonElement>('[data-view="lower-third"]')!.click();
    expect(document.querySelector('#editor-view-previews [data-preview-view="lower-third"]')?.classList.contains('lyric-view-lower-third')).toBe(true);
    expect(document.querySelector('#slide-view-settings')?.textContent).toContain('centered black band');
    expect(JSON.parse(localStorage.getItem(DECK_STORAGE_KEY)!).slides[0].styleOverride.view).toBe('lower-third');
    expect(JSON.parse(localStorage.getItem(DECK_STORAGE_KEY)!).defaultStyle.view).toBe('black-white');
    expect(stageViews.querySelector('[data-view="lower-third"]')?.getAttribute('aria-pressed')).toBe('true');

    deckViews.querySelector<HTMLButtonElement>('[data-view="custom-color"]')!.click();
    const color = document.querySelector<HTMLInputElement>('#deck-appearance-color')!;
    color.value = '#f5f5f5';
    color.dispatchEvent(new Event('change', { bubbles: true }));
    expect(JSON.parse(localStorage.getItem(DECK_STORAGE_KEY)!).defaultStyle.color).toBe('#f5f5f5');
    document.querySelector<HTMLDivElement>('#slide-view-settings')!.querySelector<HTMLButtonElement>('[data-use-default]')!.click();
    expect(document.querySelector('#editor-view-previews [data-preview-view="custom-color"]')?.classList.contains('lyric-view-custom-color')).toBe(true);
    expect(document.querySelector<HTMLElement>('#editor-view-previews [data-preview-view="custom-color"]')?.style.getPropertyValue('--lyric-foreground')).toBe('#101713');

    deckViews.querySelector<HTMLButtonElement>('[data-view="dark-church"]')!.click();
    expect(document.querySelectorAll('#deck-view-settings .background-choice')).toHaveLength(10);
    document.querySelector<HTMLButtonElement>('#deck-view-settings [data-background-id="blue-window"]')!.click();
    expect(document.querySelector<HTMLElement>('#editor-view-previews [data-preview-view="dark-church"]')?.style.getPropertyValue('--church-image')).toContain('08-blue-window-sanctuary.jpg');
    expect(JSON.parse(localStorage.getItem(DECK_STORAGE_KEY)!).defaultStyle.backgroundId).toBe('blue-window');

    document.querySelector<HTMLButtonElement>('#present-deck')!.click();
    expect(document.querySelector('#presentation-stage')?.classList.contains('lyric-view-dark-church')).toBe(true);
    cleanup();
  });

  it('keeps each slide view consistent in thumbnails and while navigating the presentation', () => {
    const root = setupDocument();
    const cleanup = renderLyricsPage(root);
    const source = document.querySelector<HTMLTextAreaElement>('#lyrics-source')!;
    source.value = 'Black line\nBlack line two\nCustom line\nCustom line two\nChurch line\nChurch line two\nLower line\nLower line two';
    document.querySelector<HTMLButtonElement>('#generate-slides')!.click();
    const selectSlide = (index: number): void => {
      document.querySelector<HTMLButtonElement>(`.thumbnail[data-slide-index="${index}"]`)!.click();
    };
    const chooseView = (view: string): void => {
      document.querySelector<HTMLDivElement>('#stage-view-options')!.querySelector<HTMLButtonElement>(`[data-view="${view}"]`)!.click();
    };

    chooseView('black-white');
    selectSlide(1);
    chooseView('custom-color');
    const slideColor = document.querySelector<HTMLInputElement>('#slide-appearance-color')!;
    slideColor.value = '#25334a';
    slideColor.dispatchEvent(new Event('change', { bubbles: true }));
    selectSlide(2);
    chooseView('dark-church');
    document.querySelector<HTMLButtonElement>('#slide-view-settings [data-background-id="emerald-glass"]')!.click();
    selectSlide(3);
    chooseView('lower-third');

    const thumbnails = Array.from(document.querySelectorAll<HTMLButtonElement>('.thumbnail'));
    expect(thumbnails[0]?.classList.contains('lyric-view-black-white')).toBe(true);
    expect(thumbnails[1]?.classList.contains('lyric-view-custom-color')).toBe(true);
    expect(thumbnails[2]?.classList.contains('lyric-view-dark-church')).toBe(true);
    expect(thumbnails[3]?.classList.contains('lyric-view-lower-third')).toBe(true);
    expect(thumbnails[1]?.style.getPropertyValue('--lyric-foreground')).toBe('#ffffff');
    expect(thumbnails[2]?.style.getPropertyValue('--church-image')).toContain('09-emerald-stained-glass.jpg');

    document.querySelector<HTMLButtonElement>('#present-deck')!.click();
    const stage = document.querySelector<HTMLElement>('#presentation-stage')!;
    expect(stage.classList.contains('lyric-view-lower-third')).toBe(true);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
    expect(stage.classList.contains('lyric-view-dark-church')).toBe(true);
    expect(stage.style.getPropertyValue('--church-image')).toContain('09-emerald-stained-glass.jpg');
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
    expect(stage.classList.contains('lyric-view-custom-color')).toBe(true);
    expect(stage.style.getPropertyValue('--lyric-foreground')).toBe('#ffffff');
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
    expect(stage.classList.contains('lyric-view-black-white')).toBe(true);
    cleanup();
  });

  it('keeps the current presentation visible when fullscreen ends after a tab switch', () => {
    const root = setupDocument();
    const cleanup = renderLyricsPage(root);
    const source = document.querySelector<HTMLTextAreaElement>('#lyrics-source')!;
    source.value = 'First slide\nSecond slide\n\nThird slide\nFourth slide';
    document.querySelector<HTMLButtonElement>('#generate-slides')!.click();
    const overlay = document.querySelector<HTMLElement>('#presentation-overlay')!;
    let fullscreenElement: Element | null = overlay;
    Object.defineProperty(document, 'fullscreenElement', {
      configurable: true,
      get: () => fullscreenElement,
    });
    document.querySelector<HTMLButtonElement>('#present-deck')!.click();
    document.querySelector<HTMLButtonElement>('#presentation-next')!.click();

    fullscreenElement = null;
    document.dispatchEvent(new Event('fullscreenchange'));

    expect(overlay.hidden).toBe(false);
    expect(document.body.classList.contains('is-presenting')).toBe(true);
    expect(document.querySelector('#presentation-counter')?.textContent).toBe('2 / 2');

    const escape = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
    document.dispatchEvent(escape);
    expect(escape.defaultPrevented).toBe(true);
    expect(document.querySelector<HTMLElement>('#presentation-overlay')!.hidden).toBe(true);
    expect(document.body.classList.contains('is-presenting')).toBe(false);
    cleanup();
  });

  it('exits presentation with Escape while fullscreen or with the Exit button when windowed', () => {
    const root = setupDocument();
    const cleanup = renderLyricsPage(root);
    const source = document.querySelector<HTMLTextAreaElement>('#lyrics-source')!;
    source.value = 'First line\nSecond line';
    document.querySelector<HTMLButtonElement>('#generate-slides')!.click();

    document.querySelector<HTMLButtonElement>('#present-deck')!.click();
    const overlay = document.querySelector<HTMLElement>('#presentation-overlay')!;
    Object.defineProperty(document, 'fullscreenElement', {
      configurable: true,
      get: () => overlay,
    });
    const escape = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
    document.dispatchEvent(escape);
    expect(escape.defaultPrevented).toBe(true);
    expect(overlay.hidden).toBe(true);
    expect(document.body.classList.contains('is-presenting')).toBe(false);

    Object.defineProperty(document, 'fullscreenElement', {
      configurable: true,
      value: null,
    });
    document.querySelector<HTMLButtonElement>('#present-deck')!.click();
    document.querySelector<HTMLButtonElement>('#presentation-exit')!.click();
    expect(overlay.hidden).toBe(true);
    expect(document.body.classList.contains('is-presenting')).toBe(false);
    cleanup();
  });

  it('flows long lyrics into readable slides while preserving every word', () => {
    const root = setupDocument();
    const cleanup = renderLyricsPage(root);
    const source = document.querySelector<HTMLTextAreaElement>('#lyrics-source')!;
    source.value = 'Diyos na makapangyarihan Haring kataas-taasan '.repeat(10).trim();
    document.querySelector<HTMLButtonElement>('#generate-slides')!.click();

    const savedDeck = JSON.parse(localStorage.getItem(DECK_STORAGE_KEY)!);
    const generatedLines = savedDeck.slides.flatMap((slide: { lines: string[] }) => slide.lines);
    expect(savedDeck.slides.length).toBeGreaterThan(1);
    expect(savedDeck.slides.every((slide: { lines: string[] }) => slide.lines.length <= 2)).toBe(true);
    expect(generatedLines.join(' ')).toBe(source.value.split(/\s+/u).join(' '));
    const safeWidth = Math.max(320, window.innerWidth - 48) * 0.86 - 32;
    expect(generatedLines.every((line: string) => line.length * 10 <= safeWidth)).toBe(true);
    expect(document.querySelector('#deck-status')?.textContent).toContain('split at word boundaries');
    cleanup();
  });

  it('preserves the current deck and pasted source when an unspaced word cannot fit', () => {
    const root = setupDocument();
    const cleanup = renderLyricsPage(root);
    const source = document.querySelector<HTMLTextAreaElement>('#lyrics-source')!;
    source.value = 'First line\nSecond line';
    document.querySelector<HTMLButtonElement>('#generate-slides')!.click();
    const originalSlides = JSON.parse(localStorage.getItem(DECK_STORAGE_KEY)!).slides;

    const unspaced = 'H'.repeat(5_001);
    source.value = unspaced;
    source.dispatchEvent(new Event('input', { bubbles: true }));
    document.querySelector<HTMLButtonElement>('#generate-slides')!.click();

    const savedDeck = JSON.parse(localStorage.getItem(DECK_STORAGE_KEY)!);
    expect(savedDeck.sourceText).toBe(unspaced);
    expect(savedDeck.slides).toEqual(originalSlides);
    expect(document.querySelector('#deck-status')?.textContent).toContain('long unspaced word');
    expect(document.querySelector('#deck-status')?.textContent).toContain('current slides were not changed');
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
    expect(document.querySelector('#editor-view-previews')?.textContent).toContain('Third line');

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
      expect(document.querySelector('#editor-view-previews')?.textContent).toContain('Line three');
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
    expect(document.querySelector('#editor-view-previews')?.textContent).toContain('C');
    cleanupSecond();
  });
});
