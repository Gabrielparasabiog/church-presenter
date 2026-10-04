import { describe, expect, it } from 'vitest';
import {
  deleteSlide,
  duplicateSlide,
  mergeWithNext,
  moveSlide,
  navigationIndex,
  MAX_LINE_LENGTH,
  MAX_SLIDES,
  normalizeLyricLines,
  splitLyrics,
  splitSlide,
  updateSlideLines,
  wrapLyricLines,
} from '../core/lyrics';
import { CHURCH_BACKGROUNDS, contrastingTextColor, defaultLyricStyle, effectiveLyricStyle } from '../core/lyricStyle';

const ids = (...values: string[]) => {
  let index = 0;
  return () => values[index++] ?? `id-${index}`;
};

describe('lyrics splitting', () => {
  it('creates one slide for every two non-empty lines', () => {
    const slides = splitLyrics('One\nTwo\n\nThree\nFour', ids('a', 'b'));
    expect(slides.map((slide) => slide.lines)).toEqual([['One', 'Two'], ['Three', 'Four']]);
  });

  it('keeps an odd final line as a valid one-line slide', () => {
    const slides = splitLyrics('One\nTwo\nThree', ids('a', 'b'));
    expect(slides[1]?.lines).toEqual(['Three']);
  });

  it('normalizes Windows line endings and preserves Unicode/Tagalog text', () => {
    const slides = splitLyrics('Diyos at Ama\r\nng Aming Magulang\r\n\r\nPag-ibig Mo’y tunay', ids('a', 'b'));
    expect(slides.map((slide) => slide.lines)).toEqual([
      ['Diyos at Ama', 'ng Aming Magulang'],
      ['Pag-ibig Mo’y tunay'],
    ]);
  });

  it('wraps long source lines at word boundaries without losing words', () => {
    const longLine = 'Pag-ibig '.repeat(1_000).trim();
    expect(normalizeLyricLines(longLine)).toEqual([longLine]);

    const wrapped = wrapLyricLines([longLine], 100, (text) => text.length * 5);
    expect(wrapped.unbreakableWordCount).toBe(0);
    expect(wrapped.lines.length).toBeGreaterThan(1);
    expect(wrapped.lines.every((line) => line.length <= MAX_LINE_LENGTH)).toBe(true);
    expect(wrapped.lines.join(' ')).toBe(longLine);
    expect(wrapped.lines.every((line) => line.length * 5 <= 100)).toBe(true);
  });

  it('rejects unbreakable words rather than guessing or truncating', () => {
    const unbreakable = 'H'.repeat(MAX_LINE_LENGTH + 1);
    expect(normalizeLyricLines(`Readable words\n${unbreakable}`)).toEqual(['Readable words', unbreakable]);
    expect(wrapLyricLines(['Readable words', unbreakable], 100, (text) => text.length * 2)).toEqual({
      lines: [],
      unbreakableWordCount: 1,
    });
  });

  it('keeps slide creation within the existing deck limit', () => {
    const manyLines = Array.from({ length: MAX_SLIDES * 2 + 2 }, (_, index) => `Line ${index + 1}`).join('\n');
    expect(splitLyrics(manyLines)).toHaveLength(MAX_SLIDES);
  });
});

describe('slide editing', () => {
  const base = splitLyrics('A\nB\nC', ids('a', 'b'));

  it('updates, reorders, duplicates, and deletes slides', () => {
    const updated = updateSlideLines(base[0]!, 'New A', 'New B');
    expect(updated.lines).toEqual(['New A', 'New B']);
    expect(moveSlide(base, 0, 1).map((slide) => slide.id)).toEqual(['b', 'a']);
    expect(duplicateSlide(base, 0, ids('copy'))).toHaveLength(3);
    expect(deleteSlide(base, 0).map((slide) => slide.id)).toEqual(['b']);
  });

  it('splits a two-line slide and merges adjacent one-line slides', () => {
    const separated = splitSlide(base, 0, ids('new'));
    expect(separated.map((slide) => slide.lines)).toEqual([['A'], ['B'], ['C']]);
    expect(mergeWithNext(separated, 0).map((slide) => slide.lines)).toEqual([['A', 'B'], ['C']]);
  });

  it('does not merge when either slide already has two lines', () => {
    expect(mergeWithNext(base, 0)).toBe(base);
  });

  it('inherits the deck lyric view unless a slide has an override', () => {
    const deckStyle = { ...defaultLyricStyle(), view: 'dark-church' as const, backgroundId: 'blue-window' as const };
    expect(effectiveLyricStyle(base[0]!, deckStyle)).toBe(deckStyle);
    const override = { ...defaultLyricStyle(), view: 'lower-third' as const };
    expect(effectiveLyricStyle({ ...base[0]!, styleOverride: override }, deckStyle)).toBe(override);
  });
});

describe('lyric view options', () => {
  it('bundles ten distinct church backdrops and chooses contrasting text colors', () => {
    expect(CHURCH_BACKGROUNDS).toHaveLength(10);
    expect(new Set(CHURCH_BACKGROUNDS.map(({ id }) => id)).size).toBe(10);
    expect(new Set(CHURCH_BACKGROUNDS.map(({ file }) => file)).size).toBe(10);
    expect(contrastingTextColor('#00ff57')).toBe('#101713');
    expect(contrastingTextColor('#f5f5f5')).toBe('#101713');
    expect(contrastingTextColor('#101010')).toBe('#ffffff');
  });
});

describe('presentation navigation', () => {
  it('supports all required keys without wrapping', () => {
    expect(navigationIndex('ArrowRight', 0, 3)).toBe(1);
    expect(navigationIndex(' ', 1, 3)).toBe(2);
    expect(navigationIndex('PageDown', 2, 3)).toBe(2);
    expect(navigationIndex('ArrowLeft', 0, 3)).toBe(0);
    expect(navigationIndex('PageUp', 2, 3)).toBe(1);
    expect(navigationIndex('Home', 2, 3)).toBe(0);
    expect(navigationIndex('End', 0, 3)).toBe(2);
  });
});
