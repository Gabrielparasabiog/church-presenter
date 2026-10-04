import { byId, downloadText, enterFullscreen, escapeHtml, exitFullscreen, fitText, isEditableTarget } from '../core/dom';
import {
  MAX_SLIDES,
  deleteSlide,
  duplicateSlide,
  mergeWithNext,
  moveSlide,
  navigationIndex,
  normalizeLyricLines,
  splitLyrics,
  splitSlide,
  updateSlideLines,
  wrapLyricLines,
} from '../core/lyrics';
import { MAX_IMPORT_BYTES, createEmptyDeck, loadDeck, parseDeckImport, saveDeck, serializeDeck } from '../core/storage';
import { ScreenWakeLock } from '../core/wakeLock';
import { CHURCH_BACKGROUNDS, LYRIC_VIEWS, churchBackgroundFile, contrastingTextColor, effectiveLyricStyle } from '../core/lyricStyle';
import type { LyricDeck, LyricStyle, LyricView } from '../types';
import { pageShell, type PageCleanup } from './shell';

function viewPickerMarkup(activeStyle: LyricStyle): string {
  const base = import.meta.env.BASE_URL;
  const choices = LYRIC_VIEWS.map(({ id, label, description }) => {
    const previewStyle = `--preview-color:${activeStyle.color};--preview-image:url("${base}church-backgrounds/${churchBackgroundFile(activeStyle.backgroundId)}")`;
    return `<button class="view-choice" type="button" data-view="${id}" data-scope="deck" aria-pressed="${activeStyle.view === id}" style="${previewStyle}">
      <span class="view-choice-preview preview-${id}" aria-hidden="true"><i></i><i></i></span>
      <span><strong>${label}</strong><small>${description}</small></span>
    </button>`;
  }).join('');
  return `<div class="view-choice-grid" role="group" aria-label="Choose a default lyric view">${choices}</div>`;
}

function stageViewPickerMarkup(style: LyricStyle): string {
  const base = import.meta.env.BASE_URL;
  const choices = LYRIC_VIEWS.map(({ id, label, description }) => {
    const previewStyle = `--preview-color:${style.color};--preview-image:url("${base}church-backgrounds/${churchBackgroundFile(style.backgroundId)}")`;
    return `<button class="stage-view-choice" type="button" data-view="${id}" aria-pressed="${style.view === id}" style="${previewStyle}" aria-label="${label}: ${description}">
      <span class="view-choice-preview preview-${id}" aria-hidden="true"><i></i><i></i></span>
      <span>${label}</span>
    </button>`;
  }).join('');
  return `<div class="stage-view-picker">
    <span class="stage-view-heading">Slide view</span>
    <div class="stage-view-grid" role="group" aria-label="Choose a view for the current slide">${choices}</div>
  </div>`;
}

function editorViewPreviewMarkup(slide: LyricDeck['slides'][number], activeStyle: LyricStyle): string {
  const previews = LYRIC_VIEWS.map(({ id, label }) => {
    const lyrics = slide.lines.map((line) => `<span>${escapeHtml(line)}</span>`).join('');
    return `<div class="view-preview${activeStyle.view === id ? ' is-current-view' : ''}" data-preview-view="${id}" role="img" aria-label="${label} preview: ${escapeHtml(slide.lines.join('. '))}">
      <div class="view-preview-copy">${lyrics}</div>
    </div>`;
  }).join('');
  return previews;
}

function styleSettingsMarkup(style: LyricStyle, scope: 'deck' | 'slide', inherited = false): string {
  if (inherited) {
    return `<p class="helper-text">This slide follows the deck default. Change its view above to customize this slide only.</p>`;
  }
  if (style.view === 'custom-color') {
    return `<label class="select-label" for="${scope}-appearance-color">Background color</label>
      <div class="color-picker-row"><input id="${scope}-appearance-color" data-custom-color="${scope}" type="color" value="${style.color}" /><span>${style.color.toUpperCase()} · text contrast adjusts automatically</span></div>`;
  }
  if (style.view === 'dark-church') {
    const base = import.meta.env.BASE_URL;
    const choices = CHURCH_BACKGROUNDS.map(({ id, label, file }) => `<button class="background-choice" type="button" data-background-id="${id}" data-scope="${scope}" aria-pressed="${style.backgroundId === id}" aria-label="${label}" title="${label}" style="--background-preview:url('${base}church-backgrounds/${file}')"><span>${label}</span></button>`).join('');
    return `<p class="select-label">Choose a sanctuary</p><div class="background-choice-grid" role="group" aria-label="Choose a church background">${choices}</div>`;
  }
  if (style.view === 'legacy-white') {
    return `<p class="helper-text">This slide keeps its original white background from an older deck. Choose one of the four views above to change it.</p>`;
  }
  if (style.view === 'lower-third') {
    return `<p class="helper-text">Lyrics sit in a centered black band near the bottom of a clean white screen.</p>`;
  }
  return `<p class="helper-text">White lyrics on a black background—ready for a dark room.</p>`;
}

function applyLyricStyle(element: HTMLElement, style: LyricStyle): void {
  element.classList.remove('lyric-view-black-white', 'lyric-view-custom-color', 'lyric-view-dark-church', 'lyric-view-lower-third', 'lyric-view-legacy-white');
  element.classList.add(`lyric-view-${style.view}`);
  element.style.setProperty('--lyric-background', style.color);
  element.style.setProperty('--lyric-foreground', contrastingTextColor(style.color));
  element.style.setProperty('--church-image', `url("${import.meta.env.BASE_URL}church-backgrounds/${churchBackgroundFile(style.backgroundId)}")`);
}

export function renderLyricsPage(root: HTMLElement): PageCleanup {
  let deck: LyricDeck = loadDeck();
  let isPresenting = false;
  let isBlanked = false;
  let fitGeneration = 0;
  let fitAnimationId = 0;
  let fitTimerId = 0;
  let sourceSaveTimerId = 0;
  let lastFocusedElement: HTMLElement | null = null;
  const wakeLock = new ScreenWakeLock();

  root.innerHTML = pageShell(
    'Lyrics Presenter',
    'Every two lines, ready for the room',
    `<section class="lyrics-workspace">
      <div class="lyrics-toolbar" aria-label="Deck controls">
        <div class="deck-title-wrap">
          <label for="deck-title">Deck title</label>
          <input id="deck-title" maxlength="200" value="${escapeHtml(deck.title)}" />
        </div>
        <div class="toolbar-actions">
          <button id="deck-new" class="button button-quiet" type="button">New</button>
          <button id="deck-clear" class="button button-quiet" type="button">Clear</button>
          <button id="deck-export" class="button button-quiet" type="button">Export JSON</button>
          <label class="button button-quiet file-button">Import JSON<input id="deck-import" type="file" accept=".json,.church-presenter.json,application/json" /></label>
        </div>
      </div>

      <div class="editor-grid">
        <aside class="source-panel control-card">
          <div>
            <p class="control-label">1 · Paste complete lyrics</p>
            <textarea id="lyrics-source" rows="11" maxlength="${MAX_IMPORT_BYTES}" placeholder="Paste the complete lyrics here…">${escapeHtml(deck.sourceText)}</textarea>
            <p class="helper-text">Blank lines are ignored. Up to two rows appear per slide; extra-long lines split at spaces across additional slides to stay readable.</p>
            <button id="generate-slides" class="button button-primary" type="button">Generate two-line slides</button>
          </div>
          <div class="source-divider"></div>
          <div class="appearance-settings">
            <p class="select-label">Default lyric view</p>
            <div id="deck-view-options"></div>
            <div id="deck-view-settings"></div>
          </div>
        </aside>

        <section class="deck-editor" aria-label="Slide editor">
          <div class="canvas-bar">
            <div><span class="live-dot"></span><span id="slide-position">Slide 0 of 0</span></div>
            <button id="present-deck" class="button button-gold" type="button" ${deck.slides.length ? '' : 'disabled'}>Present fullscreen</button>
          </div>
          <div id="stage-view-options" hidden></div>
          <div id="editor-canvas" class="editor-canvas" tabindex="0" aria-label="Four views of the current lyric slide; double click to present the selected view">
            <div id="editor-view-previews" class="editor-view-previews" role="group" aria-label="All four views of the current slide" hidden></div>
            <p id="empty-slide-message" class="empty-slide-message">Paste lyrics and generate your first deck.</p>
          </div>
          <div class="thumbnail-header"><span>Slides</span><span>← / → change slide · Double-click to present</span></div>
          <div id="thumbnail-strip" class="thumbnail-strip" role="listbox" aria-label="Lyric slides"></div>
        </section>

        <aside class="slide-panel control-card" aria-label="Selected slide controls">
          <div id="slide-editor-empty" class="panel-empty">Select or generate a slide to edit its words and order.</div>
          <div id="slide-editor-fields" hidden>
            <p class="control-label">2 · Refine selected slide</p>
            <label for="slide-line-one">Line one</label>
            <textarea id="slide-line-one" rows="3"></textarea>
            <label for="slide-line-two">Line two <span>(optional)</span></label>
            <textarea id="slide-line-two" rows="3"></textarea>
            <div class="appearance-settings">
              <p class="select-label">Per-slide appearance</p>
              <div id="slide-view-settings"></div>
            </div>
            <div class="slide-actions">
              <button id="slide-up" type="button" title="Move slide left" aria-label="Move slide left">←</button>
              <button id="slide-down" type="button" title="Move slide right" aria-label="Move slide right">→</button>
              <button id="slide-duplicate" type="button">Duplicate</button>
              <button id="slide-split" type="button">Split</button>
              <button id="slide-merge" type="button">Merge next</button>
              <button id="slide-delete" class="danger" type="button">Delete</button>
            </div>
          </div>
        </aside>
      </div>
      <p id="deck-status" class="status-message" role="status" aria-live="polite"></p>
    </section>
    <section id="presentation-overlay" class="presentation-overlay" hidden aria-label="Lyrics presentation">
      <div id="presentation-stage" class="presentation-stage" tabindex="-1">
        <button id="presentation-previous" class="presentation-zone previous" type="button" aria-label="Previous slide"></button>
        <div id="presentation-copy" class="presentation-copy"></div>
        <button id="presentation-next" class="presentation-zone next" type="button" aria-label="Next slide"></button>
        <div id="presentation-counter" class="presentation-counter"></div>
        <p class="presentation-help" aria-hidden="true">← → slides · B blackout · Esc exit</p>
        <p id="presentation-status" class="sr-only" role="status" aria-live="polite"></p>
        <button id="presentation-exit" class="presentation-exit" type="button" aria-label="Exit presentation">Exit</button>
      </div>
    </section>`,
    'lyrics',
  );

  const title = byId<HTMLInputElement>('deck-title');
  const source = byId<HTMLTextAreaElement>('lyrics-source');
  const deckViewOptions = byId<HTMLDivElement>('deck-view-options');
  const deckViewSettings = byId<HTMLDivElement>('deck-view-settings');
  const slideViewSettings = byId<HTMLDivElement>('slide-view-settings');
  const stageViewOptions = byId<HTMLDivElement>('stage-view-options');
  const editorViewPreviews = byId<HTMLDivElement>('editor-view-previews');
  const generate = byId<HTMLButtonElement>('generate-slides');
  const canvas = byId<HTMLDivElement>('editor-canvas');
  const emptyMessage = byId<HTMLParagraphElement>('empty-slide-message');
  const slidePosition = byId<HTMLSpanElement>('slide-position');
  const thumbnails = byId<HTMLDivElement>('thumbnail-strip');
  const present = byId<HTMLButtonElement>('present-deck');
  const editorEmpty = byId<HTMLDivElement>('slide-editor-empty');
  const editorFields = byId<HTMLDivElement>('slide-editor-fields');
  const lineOne = byId<HTMLTextAreaElement>('slide-line-one');
  const lineTwo = byId<HTMLTextAreaElement>('slide-line-two');
  const status = byId<HTMLParagraphElement>('deck-status');
  const overlay = byId<HTMLElement>('presentation-overlay');
  const presentationStage = byId<HTMLDivElement>('presentation-stage');
  const presentationCopy = byId<HTMLDivElement>('presentation-copy');
  const presentationCounter = byId<HTMLDivElement>('presentation-counter');
  const presentationStatus = byId<HTMLParagraphElement>('presentation-status');

  const currentSlide = () => deck.slides[deck.currentIndex];
  const fitLyricCopy = (element: HTMLElement, stage: HTMLElement, style: LyricStyle, maxPx: number, minPx: number): void => {
    const lowerThirdCap = style.view === 'lower-third' && stage.clientHeight > 0
      ? Math.max(14, Math.floor(stage.clientHeight * 0.046))
      : maxPx;
    fitText(element, Math.min(maxPx, lowerThirdCap), minPx);
  };
  const fitEditorCopy = (): void => {
    const slide = currentSlide();
    if (!slide) return;
    const activeStyle = effectiveLyricStyle(slide, deck.defaultStyle);
    editorViewPreviews.querySelectorAll<HTMLElement>('[data-preview-view]').forEach((preview) => {
      const view = preview.dataset.previewView as LyricView | undefined;
      const copy = preview.querySelector<HTMLElement>('.view-preview-copy');
      if (!view || !copy) return;
      fitLyricCopy(copy, preview, { ...activeStyle, view }, 54, 4);
    });
  };
  const fitPresentationCopy = (): void => {
    const slide = currentSlide();
    if (!slide) return;
    fitLyricCopy(presentationCopy, presentationStage, effectiveLyricStyle(slide, deck.defaultStyle), 112, 12);
  };
  const getLyricsWrapMetrics = (): { maxWidth: number; measureText: (text: string) => number } | null => {
    const canvasWidth = canvas.clientWidth || canvas.getBoundingClientRect().width || Math.max(320, window.innerWidth - 48);
    const maxWidth = canvasWidth * 0.86 - 32;
    if (maxWidth <= 0) return null;

    const fontSize = 54;
    const styles = window.getComputedStyle(canvas);
    const context = document.createElement('canvas').getContext('2d');
    if (context) {
      context.font = `${styles.fontStyle} 700 ${fontSize}px ${styles.fontFamily}`;
      return { maxWidth, measureText: (text) => context.measureText(text).width };
    }
    return { maxWidth, measureText: (text) => text.length * fontSize * 0.58 };
  };
  const fitAfterFonts = (fit: () => void): void => {
    const generation = ++fitGeneration;
    window.cancelAnimationFrame(fitAnimationId);
    window.clearTimeout(fitTimerId);
    const run = (): void => { if (generation === fitGeneration) fit(); };
    fitAnimationId = requestAnimationFrame(run);
    void document.fonts.ready.then(run);
    fitTimerId = window.setTimeout(run, 180);
  };
  const persist = (): void => {
    deck = { ...deck, updatedAt: new Date().toISOString() };
    try {
      saveDeck(deck);
    } catch {
      setStatus('This browser could not save the latest change. Export the deck before leaving this page.');
    }
  };
  const setStatus = (message: string): void => { status.textContent = message; };

  const renderPresentation = (): void => {
    const slide = currentSlide();
    if (!slide) return;
    presentationStage.className = `presentation-stage${isBlanked ? ' is-blank' : ''}`;
    applyLyricStyle(presentationStage, effectiveLyricStyle(slide, deck.defaultStyle));
    presentationCopy.innerHTML = slide.lines.map((line) => `<span>${escapeHtml(line)}</span>`).join('');
    presentationCounter.textContent = `${deck.currentIndex + 1} / ${deck.slides.length}`;
    presentationStatus.textContent = isBlanked
      ? 'Projection is blacked out.'
      : `Slide ${deck.currentIndex + 1} of ${deck.slides.length}: ${slide.lines.join('. ')}`;
    fitPresentationCopy();
    fitAfterFonts(fitPresentationCopy);
  };

  const render = (): void => {
    deck.currentIndex = Math.max(0, Math.min(deck.currentIndex, Math.max(0, deck.slides.length - 1)));
    const slide = currentSlide();
    title.value = deck.title;
    const style = slide ? effectiveLyricStyle(slide, deck.defaultStyle) : deck.defaultStyle;
    const inheritsDeckStyle = Boolean(slide && slide.styleOverride === null);
    deckViewOptions.innerHTML = viewPickerMarkup(deck.defaultStyle);
    deckViewSettings.innerHTML = styleSettingsMarkup(deck.defaultStyle, 'deck');
    stageViewOptions.hidden = !slide;
    stageViewOptions.innerHTML = slide ? stageViewPickerMarkup(style) : '';
    const useDeckDefault = slide && !inheritsDeckStyle
      ? '<button class="button button-quiet slide-default-button" type="button" data-use-default>Use deck default</button>'
      : '';
    slideViewSettings.innerHTML = slide ? `${useDeckDefault}${styleSettingsMarkup(style, 'slide', inheritsDeckStyle)}` : '';
    slidePosition.textContent = `Slide ${slide ? deck.currentIndex + 1 : 0} of ${deck.slides.length}`;
    present.disabled = !deck.slides.length;
    emptyMessage.hidden = Boolean(slide);
    editorViewPreviews.hidden = !slide;
    if (slide) {
      editorViewPreviews.innerHTML = editorViewPreviewMarkup(slide, style);
      editorViewPreviews.querySelectorAll<HTMLElement>('[data-preview-view]').forEach((preview) => {
        const view = preview.dataset.previewView as LyricView | undefined;
        if (view) applyLyricStyle(preview, { ...style, view });
      });
      lineOne.value = slide.lines[0];
      lineTwo.value = slide.lines[1] ?? '';
      editorEmpty.hidden = true;
      editorFields.hidden = false;
      byId<HTMLButtonElement>('slide-up').disabled = deck.currentIndex === 0;
      byId<HTMLButtonElement>('slide-down').disabled = deck.currentIndex === deck.slides.length - 1;
      byId<HTMLButtonElement>('slide-split').disabled = slide.lines.length !== 2;
      const next = deck.slides[deck.currentIndex + 1];
      byId<HTMLButtonElement>('slide-merge').disabled = slide.lines.length !== 1 || !next || next.lines.length !== 1;
      fitEditorCopy();
      fitAfterFonts(fitEditorCopy);
    } else {
      editorEmpty.hidden = false;
      editorFields.hidden = true;
    }
    thumbnails.innerHTML = deck.slides.map((item, index) => `
      <button class="thumbnail ${index === deck.currentIndex ? 'is-selected' : ''}" type="button" role="option" aria-selected="${index === deck.currentIndex}" data-slide-index="${index}">
        <span class="thumbnail-number">${index + 1}</span>
        <span class="thumbnail-copy">${item.lines.map((line) => `<span title="${escapeHtml(line)}">${escapeHtml(line)}</span>`).join('')}</span>
      </button>`).join('');
    thumbnails.querySelectorAll<HTMLButtonElement>('.thumbnail').forEach((thumbnail, index) => {
      const item = deck.slides[index];
      if (item) applyLyricStyle(thumbnail, effectiveLyricStyle(item, deck.defaultStyle));
    });
    if (isPresenting) renderPresentation();
  };

  const selectSlide = (index: number, focusThumbnail = false): void => {
    if (index < 0 || index >= deck.slides.length || index === deck.currentIndex) return;
    deck.currentIndex = index;
    persist();
    render();
    const selectedThumbnail = thumbnails.querySelector<HTMLButtonElement>('[aria-selected="true"]');
    selectedThumbnail?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
    if (focusThumbnail) selectedThumbnail?.focus();
  };
  const onThumbnail = (event: Event): void => {
    const target = (event.target as HTMLElement).closest<HTMLElement>('[data-slide-index]');
    if (target) selectSlide(Number(target.dataset.slideIndex), true);
  };
  const onGenerate = (): void => {
    window.clearTimeout(sourceSaveTimerId);
    const sourceLines = normalizeLyricLines(source.value);
    deck = { ...deck, sourceText: source.value };
    if (!sourceLines.length) {
      deck = { ...deck, slides: [], currentIndex: 0 };
      persist();
      setStatus('Add at least one non-empty lyric line.');
      render();
      return;
    }

    const metrics = getLyricsWrapMetrics();
    if (!metrics) {
      persist();
      setStatus('The slide preview is not ready yet. Try generating the slides again.');
      return;
    }

    const wrapped = wrapLyricLines(sourceLines, metrics.maxWidth, metrics.measureText);
    if (wrapped.unbreakableWordCount) {
      persist();
      setStatus(`${wrapped.unbreakableWordCount} long unspaced word(s) cannot fit safely. Add spaces or line breaks; your pasted lyrics are preserved and the current slides were not changed.`);
      return;
    }

    const slides = splitLyrics(wrapped.lines.join('\n'));
    deck = { ...deck, slides, currentIndex: 0 };
    persist();
    const wasLimited = wrapped.lines.length > MAX_SLIDES * 2;
    const wasWrapped = wrapped.lines.length > sourceLines.length;
    setStatus(slides.length
      ? `${slides.length} slides generated and saved in this browser.${wasWrapped ? ' Long lines were split at word boundaries to stay readable.' : ''}${wasLimited ? ` Only the first ${MAX_SLIDES} slides were included.` : ''}`
      : 'Add at least one non-empty lyric line.');
    render();
  };
  const updateCurrent = (): void => {
    const slide = currentSlide();
    if (!slide) return;
    deck.slides[deck.currentIndex] = updateSlideLines(slide, lineOne.value, lineTwo.value);
    persist(); render();
  };
  const startPresentation = (): void => {
    if (!deck.slides.length) return;
    lastFocusedElement = document.activeElement instanceof HTMLElement ? document.activeElement : present;
    isPresenting = true;
    isBlanked = false;
    overlay.hidden = false;
    document.body.classList.add('is-presenting');
    renderPresentation();
    presentationStage.focus();
    void wakeLock.start();
    void enterFullscreen(overlay)
      .then(() => fitAfterFonts(fitPresentationCopy))
      .catch(() => fitAfterFonts(fitPresentationCopy));
  };
  const stopPresentation = (): void => {
    isPresenting = false;
    isBlanked = false;
    overlay.hidden = true;
    document.body.classList.remove('is-presenting');
    void wakeLock.stop();
    void exitFullscreen().catch(() => undefined);
    window.setTimeout(() => lastFocusedElement?.focus(), 0);
  };
  const navigate = (key: string): void => {
    const next = navigationIndex(key, deck.currentIndex, deck.slides.length);
    if (next !== deck.currentIndex) { deck.currentIndex = next; persist(); renderPresentation(); }
  };
  const onKeyDown = (event: KeyboardEvent): void => {
    if (!isPresenting) {
      if (!['ArrowRight', 'ArrowLeft'].includes(event.key) || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
      const target = event.target instanceof HTMLElement ? event.target : null;
      const focusedThumbnail = target?.closest<HTMLButtonElement>('[data-slide-index]') ?? null;
      const isThumbnailFocused = Boolean(focusedThumbnail && thumbnails.contains(focusedThumbnail));
      if ((isEditableTarget(target) && !isThumbnailFocused) || deck.slides.length === 0) return;

      event.preventDefault();
      const next = navigationIndex(event.key, deck.currentIndex, deck.slides.length);
      if (next !== deck.currentIndex) selectSlide(next, isThumbnailFocused);
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      stopPresentation();
      return;
    }
    if (isEditableTarget(event.target)) return;
    if (event.key.toLowerCase() === 'b') {
      event.preventDefault();
      isBlanked = !isBlanked;
      renderPresentation();
      return;
    }
    if (['ArrowRight', 'ArrowLeft', ' ', 'PageDown', 'PageUp', 'Home', 'End'].includes(event.key)) {
      event.preventDefault(); navigate(event.key);
    }
  };
  const onFullscreenChange = (): void => {
    if (isPresenting) fitAfterFonts(fitPresentationCopy);
  };
  const onResize = (): void => {
    if (isPresenting) fitPresentationCopy();
    else fitEditorCopy();
  };
  const resizeObserver = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(onResize);
  resizeObserver?.observe(canvas);
  resizeObserver?.observe(presentationStage);

  generate.addEventListener('click', onGenerate);
  thumbnails.addEventListener('click', onThumbnail);
  title.addEventListener('input', () => { deck.title = title.value; persist(); });
  source.addEventListener('input', () => {
    deck.sourceText = source.value;
    window.clearTimeout(sourceSaveTimerId);
    sourceSaveTimerId = window.setTimeout(persist, 250);
  });
  const onViewChoice = (event: Event, scope: 'deck' | 'slide'): void => {
    const target = event.target instanceof HTMLElement ? event.target.closest<HTMLButtonElement>('[data-view], [data-use-default]') : null;
    if (!target) return;
    if (scope === 'deck') {
      const view = target.dataset.view as LyricView | undefined;
      if (!view || !LYRIC_VIEWS.some((choice) => choice.id === view)) return;
      deck.defaultStyle = { ...deck.defaultStyle, view };
    } else {
      const slide = currentSlide();
      if (!slide) return;
      const view = target.dataset.view as LyricView | undefined;
      if (!view || !LYRIC_VIEWS.some((choice) => choice.id === view)) return;
      slide.styleOverride = { ...effectiveLyricStyle(slide, deck.defaultStyle), view };
    }
    persist();
    render();
  };
  const onBackgroundChoice = (event: Event, scope: 'deck' | 'slide'): void => {
    const target = event.target instanceof HTMLElement ? event.target.closest<HTMLButtonElement>('[data-background-id]') : null;
    const backgroundId = target?.dataset.backgroundId;
    if (!backgroundId || !CHURCH_BACKGROUNDS.some((background) => background.id === backgroundId)) return;
    if (scope === 'deck') deck.defaultStyle = { ...deck.defaultStyle, backgroundId: backgroundId as LyricStyle['backgroundId'] };
    else {
      const slide = currentSlide();
      if (!slide) return;
      slide.styleOverride = { ...effectiveLyricStyle(slide, deck.defaultStyle), backgroundId: backgroundId as LyricStyle['backgroundId'] };
    }
    persist();
    render();
  };
  const onCustomColor = (event: Event, scope: 'deck' | 'slide'): void => {
    const input = event.target instanceof HTMLInputElement && event.target.dataset.customColor === scope ? event.target : null;
    if (!input || !/^#[\da-f]{6}$/iu.test(input.value)) return;
    if (scope === 'deck') deck.defaultStyle = { ...deck.defaultStyle, color: input.value.toLowerCase() };
    else {
      const slide = currentSlide();
      if (!slide) return;
      slide.styleOverride = { ...effectiveLyricStyle(slide, deck.defaultStyle), color: input.value.toLowerCase() };
    }
    persist();
    render();
  };
  deckViewOptions.addEventListener('click', (event) => onViewChoice(event, 'deck'));
  stageViewOptions.addEventListener('click', (event) => onViewChoice(event, 'slide'));
  slideViewSettings.addEventListener('click', (event) => {
    const target = event.target instanceof HTMLElement ? event.target.closest<HTMLButtonElement>('[data-use-default]') : null;
    const slide = currentSlide();
    if (!target || !slide) return;
    slide.styleOverride = null;
    persist();
    render();
  });
  deckViewSettings.addEventListener('click', (event) => onBackgroundChoice(event, 'deck'));
  slideViewSettings.addEventListener('click', (event) => onBackgroundChoice(event, 'slide'));
  deckViewSettings.addEventListener('change', (event) => onCustomColor(event, 'deck'));
  slideViewSettings.addEventListener('change', (event) => onCustomColor(event, 'slide'));
  lineOne.addEventListener('input', updateCurrent);
  lineTwo.addEventListener('input', updateCurrent);
  byId<HTMLButtonElement>('slide-up').addEventListener('click', () => { deck.slides = moveSlide(deck.slides, deck.currentIndex, -1); deck.currentIndex--; persist(); render(); });
  byId<HTMLButtonElement>('slide-down').addEventListener('click', () => { deck.slides = moveSlide(deck.slides, deck.currentIndex, 1); deck.currentIndex++; persist(); render(); });
  byId<HTMLButtonElement>('slide-duplicate').addEventListener('click', () => { deck.slides = duplicateSlide(deck.slides, deck.currentIndex); deck.currentIndex++; persist(); render(); });
  byId<HTMLButtonElement>('slide-split').addEventListener('click', () => { deck.slides = splitSlide(deck.slides, deck.currentIndex); persist(); render(); });
  byId<HTMLButtonElement>('slide-merge').addEventListener('click', () => { deck.slides = mergeWithNext(deck.slides, deck.currentIndex); persist(); render(); });
  byId<HTMLButtonElement>('slide-delete').addEventListener('click', () => {
    if (!window.confirm('Delete this slide?')) return;
    deck.slides = deleteSlide(deck.slides, deck.currentIndex); persist(); render();
  });
  byId<HTMLButtonElement>('deck-new').addEventListener('click', () => {
    if ((deck.slides.length || deck.sourceText.trim()) && !window.confirm('Start a new deck? Export first if you want to keep this one.')) return;
    deck = createEmptyDeck(); source.value = ''; persist(); setStatus('A new blank deck is ready.'); render();
  });
  byId<HTMLButtonElement>('deck-clear').addEventListener('click', () => {
    if (deck.slides.length && !window.confirm('Clear all generated slides? Your pasted lyrics will remain.')) return;
    deck.slides = []; deck.currentIndex = 0; persist(); setStatus('Slides cleared. Your pasted lyrics remain available.'); render();
  });
  byId<HTMLButtonElement>('deck-export').addEventListener('click', () => { downloadText(`${deck.title.trim().replace(/[^a-z0-9]+/gi, '-').toLowerCase() || 'lyrics'}.church-presenter.json`, serializeDeck(deck)); setStatus('Deck exported.'); });
  byId<HTMLInputElement>('deck-import').addEventListener('change', async (event) => {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0]; if (!file) return;
    try {
      if (file.size > MAX_IMPORT_BYTES) throw new Error('This file is larger than the 2 MB import limit.');
      const imported = parseDeckImport(await file.text()); deck = imported; source.value = deck.sourceText; persist(); render(); setStatus('Deck imported and saved.');
    }
    catch (error) { setStatus(error instanceof Error ? error.message : 'The deck could not be imported.'); }
    input.value = '';
  });
  present.addEventListener('click', startPresentation);
  canvas.addEventListener('dblclick', startPresentation);
  byId<HTMLButtonElement>('presentation-exit').addEventListener('click', stopPresentation);
  byId<HTMLButtonElement>('presentation-previous').addEventListener('click', () => navigate('ArrowLeft'));
  byId<HTMLButtonElement>('presentation-next').addEventListener('click', () => navigate('ArrowRight'));
  document.addEventListener('keydown', onKeyDown);
  document.addEventListener('fullscreenchange', onFullscreenChange);
  window.addEventListener('resize', onResize);
  render();

  return () => {
    document.removeEventListener('keydown', onKeyDown);
    document.removeEventListener('fullscreenchange', onFullscreenChange);
    window.removeEventListener('resize', onResize);
    resizeObserver?.disconnect();
    ++fitGeneration;
    window.cancelAnimationFrame(fitAnimationId);
    window.clearTimeout(fitTimerId);
    window.clearTimeout(sourceSaveTimerId);
    if (deck.sourceText !== source.value) deck.sourceText = source.value;
    try { saveDeck({ ...deck, updatedAt: new Date().toISOString() }); } catch { /* Best effort during route teardown. */ }
    wakeLock.destroy();
    document.body.classList.remove('is-presenting');
  };
}
