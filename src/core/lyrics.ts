import type { LyricSlide, ThemeName } from '../types';

export const MAX_SLIDES = 500;
export const MAX_LINE_LENGTH = 5_000;

const newId = (): string =>
  globalThis.crypto?.randomUUID?.() ?? `slide-${Date.now()}-${Math.random().toString(36).slice(2)}`;

export function normalizeLyricLines(source: string): string[] {
  return source
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

export function splitLyrics(source: string, idFactory: () => string = newId): LyricSlide[] {
  const lines = normalizeLyricLines(source);
  const slides: LyricSlide[] = [];
  for (let index = 0; index < lines.length && slides.length < MAX_SLIDES; index += 2) {
    const first = lines[index];
    const second = lines[index + 1];
    if (first === undefined) break;
    slides.push({
      id: idFactory(),
      lines: second === undefined ? [first] : [first, second],
      themeOverride: null,
    });
  }
  return slides;
}

export function updateSlideLines(slide: LyricSlide, first: string, second: string): LyricSlide {
  const lineOne = first.trim().slice(0, MAX_LINE_LENGTH);
  const lineTwo = second.trim().slice(0, MAX_LINE_LENGTH);
  const lines: [string] | [string, string] = lineTwo ? [lineOne, lineTwo] : [lineOne];
  return { ...slide, lines };
}

export function moveSlide(slides: LyricSlide[], index: number, offset: -1 | 1): LyricSlide[] {
  const destination = index + offset;
  if (index < 0 || index >= slides.length || destination < 0 || destination >= slides.length) return slides;
  const copy = [...slides];
  [copy[index], copy[destination]] = [copy[destination]!, copy[index]!];
  return copy;
}

export function duplicateSlide(
  slides: LyricSlide[],
  index: number,
  idFactory: () => string = newId,
): LyricSlide[] {
  const source = slides[index];
  if (!source || slides.length >= MAX_SLIDES) return slides;
  const copy = [...slides];
  copy.splice(index + 1, 0, { ...source, id: idFactory(), lines: [...source.lines] as LyricSlide['lines'] });
  return copy;
}

export function deleteSlide(slides: LyricSlide[], index: number): LyricSlide[] {
  if (index < 0 || index >= slides.length) return slides;
  return slides.filter((_, slideIndex) => slideIndex !== index);
}

export function splitSlide(
  slides: LyricSlide[],
  index: number,
  idFactory: () => string = newId,
): LyricSlide[] {
  const source = slides[index];
  if (!source || source.lines.length !== 2 || slides.length >= MAX_SLIDES) return slides;
  const [first, second] = source.lines;
  const copy = [...slides];
  copy.splice(
    index,
    1,
    { ...source, lines: [first] },
    { ...source, id: idFactory(), lines: [second] },
  );
  return copy;
}

export function mergeWithNext(slides: LyricSlide[], index: number): LyricSlide[] {
  const current = slides[index];
  const next = slides[index + 1];
  if (!current || !next || current.lines.length !== 1 || next.lines.length !== 1) return slides;
  const copy = [...slides];
  copy.splice(index, 2, { ...current, lines: [current.lines[0], next.lines[0]] });
  return copy;
}

export function effectiveTheme(slide: LyricSlide, deckTheme: ThemeName): ThemeName {
  return slide.themeOverride ?? deckTheme;
}

export function navigationIndex(key: string, index: number, slideCount: number): number {
  if (slideCount <= 0) return 0;
  if (['ArrowRight', ' ', 'PageDown'].includes(key)) return Math.min(slideCount - 1, index + 1);
  if (['ArrowLeft', 'PageUp'].includes(key)) return Math.max(0, index - 1);
  if (key === 'Home') return 0;
  if (key === 'End') return slideCount - 1;
  return index;
}
