import { byId, downloadText, enterFullscreen, escapeHtml, exitFullscreen, fitText, isEditableTarget } from '../core/dom';
import {
  MAX_SLIDES,
  deleteSlide,
  duplicateSlide,
  effectiveTheme,
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
import type { LyricDeck, ThemeName } from '../types';
import { pageShell, themeOptions, type PageCleanup } from './shell';

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
          <div>
            <label class="select-label" for="deck-theme">Default deck background</label>
            <select id="deck-theme">${themeOptions(deck.defaultTheme)}</select>
          </div>
        </aside>

        <section class="deck-editor" aria-label="Slide editor">
          <div class="canvas-bar">
            <div><span class="live-dot"></span><span id="slide-position">Slide 0 of 0</span></div>
            <button id="present-deck" class="button button-gold" type="button" ${deck.slides.length ? '' : 'disabled'}>Present fullscreen</button>
          </div>
          <div id="editor-canvas" class="editor-canvas theme-green" tabindex="0" aria-label="Current lyric slide; double click to present">
            <div id="editor-slide-copy" class="slide-copy"></div>
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
            <label class="select-label" for="slide-theme">Slide background</label>
            <select id="slide-theme"></select>
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
      <div id="presentation-stage" class="presentation-stage theme-green" tabindex="-1">
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
  const deckTheme = byId<HTMLSelectElement>('deck-theme');
  const generate = byId<HTMLButtonElement>('generate-slides');
  const canvas = byId<HTMLDivElement>('editor-canvas');
  const canvasCopy = byId<HTMLDivElement>('editor-slide-copy');
  const emptyMessage = byId<HTMLParagraphElement>('empty-slide-message');
  const slidePosition = byId<HTMLSpanElement>('slide-position');
  const thumbnails = byId<HTMLDivElement>('thumbnail-strip');
  const present = byId<HTMLButtonElement>('present-deck');
  const editorEmpty = byId<HTMLDivElement>('slide-editor-empty');
  const editorFields = byId<HTMLDivElement>('slide-editor-fields');
  const lineOne = byId<HTMLTextAreaElement>('slide-line-one');
  const lineTwo = byId<HTMLTextAreaElement>('slide-line-two');
  const slideTheme = byId<HTMLSelectElement>('slide-theme');
  const status = byId<HTMLParagraphElement>('deck-status');
  const overlay = byId<HTMLElement>('presentation-overlay');
  const presentationStage = byId<HTMLDivElement>('presentation-stage');
  const presentationCopy = byId<HTMLDivElement>('presentation-copy');
  const presentationCounter = byId<HTMLDivElement>('presentation-counter');
  const presentationStatus = byId<HTMLParagraphElement>('presentation-status');

  const currentSlide = () => deck.slides[deck.currentIndex];
  const fitEditorCopy = (): void => {
    if (!currentSlide()) return;
    fitText(canvasCopy, 54, 8);
  };
  const fitPresentationCopy = (): void => {
    if (!currentSlide()) return;
    fitText(presentationCopy, 112, 16);
  };
  const getLyricsWrapMetrics = (): { maxWidth: number; measureText: (text: string) => number } | null => {
    const canvasWidth = canvas.clientWidth || canvas.getBoundingClientRect().width || Math.max(320, window.innerWidth - 48);
    const maxWidth = canvasWidth * 0.86 - 32;
    if (maxWidth <= 0) return null;

    const fontSize = 54;
    const styles = window.getComputedStyle(canvasCopy);
    const context = document.createElement('canvas').getContext('2d');
    if (context) {
      context.font = `${styles.fontStyle} ${styles.fontWeight} ${fontSize}px ${styles.fontFamily}`;
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
    presentationStage.className = `presentation-stage theme-${effectiveTheme(slide, deck.defaultTheme)}${isBlanked ? ' is-blank' : ''}`;
    presentationCopy.innerHTML = slide.lines.map((line) => `<span>${escapeHtml(line)}</span>`).join('');
    presentationCounter.textContent = `${deck.currentIndex + 1} / ${deck.slides.length}`;
    presentationStatus.textContent = isBlanked
      ? 'Projection is blacked out.'
      : `Slide ${deck.currentIndex + 1} of ${deck.slides.length}: ${slide.lines.join('. ')}`;
    fitAfterFonts(fitPresentationCopy);
  };

  const render = (): void => {
    deck.currentIndex = Math.max(0, Math.min(deck.currentIndex, Math.max(0, deck.slides.length - 1)));
    const slide = currentSlide();
    title.value = deck.title;
    deckTheme.value = deck.defaultTheme;
    slidePosition.textContent = `Slide ${slide ? deck.currentIndex + 1 : 0} of ${deck.slides.length}`;
    present.disabled = !deck.slides.length;
    emptyMessage.hidden = Boolean(slide);
    canvasCopy.hidden = !slide;
    canvas.className = `editor-canvas theme-${slide ? effectiveTheme(slide, deck.defaultTheme) : deck.defaultTheme}`;
    if (slide) {
      canvasCopy.innerHTML = slide.lines.map((line) => `<span>${escapeHtml(line)}</span>`).join('');
      lineOne.value = slide.lines[0];
      lineTwo.value = slide.lines[1] ?? '';
      slideTheme.innerHTML = themeOptions(slide.themeOverride ?? 'inherit', true);
      editorEmpty.hidden = true;
      editorFields.hidden = false;
      byId<HTMLButtonElement>('slide-up').disabled = deck.currentIndex === 0;
      byId<HTMLButtonElement>('slide-down').disabled = deck.currentIndex === deck.slides.length - 1;
      byId<HTMLButtonElement>('slide-split').disabled = slide.lines.length !== 2;
      const next = deck.slides[deck.currentIndex + 1];
      byId<HTMLButtonElement>('slide-merge').disabled = slide.lines.length !== 1 || !next || next.lines.length !== 1;
      fitAfterFonts(fitEditorCopy);
    } else {
      editorEmpty.hidden = false;
      editorFields.hidden = true;
    }
    thumbnails.innerHTML = deck.slides.map((item, index) => `
      <button class="thumbnail ${index === deck.currentIndex ? 'is-selected' : ''} theme-${effectiveTheme(item, deck.defaultTheme)}" type="button" role="option" aria-selected="${index === deck.currentIndex}" data-slide-index="${index}">
        <span class="thumbnail-number">${index + 1}</span>
        <span class="thumbnail-copy">${item.lines.map((line) => `<span title="${escapeHtml(line)}">${escapeHtml(line)}</span>`).join('')}</span>
      </button>`).join('');
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
      if (!document.fullscreenElement) stopPresentation();
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
    if (isPresenting && !document.fullscreenElement) stopPresentation();
    else if (isPresenting) fitAfterFonts(fitPresentationCopy);
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
  deckTheme.addEventListener('change', () => { deck.defaultTheme = deckTheme.value as ThemeName; persist(); render(); });
  lineOne.addEventListener('input', updateCurrent);
  lineTwo.addEventListener('input', updateCurrent);
  slideTheme.addEventListener('change', () => {
    const slide = currentSlide(); if (!slide) return;
    slide.themeOverride = slideTheme.value === 'inherit' ? null : slideTheme.value as ThemeName;
    persist(); render();
  });
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
