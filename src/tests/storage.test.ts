import { beforeEach, describe, expect, it } from 'vitest';
import {
  DECK_STORAGE_KEY,
  MAX_IMPORT_BYTES,
  createEmptyDeck,
  loadDeck,
  loadTimerSettings,
  parseDeckImport,
  saveDeck,
  serializeDeck,
} from '../core/storage';
import { splitLyrics } from '../core/lyrics';

describe('versioned browser persistence', () => {
  beforeEach(() => localStorage.clear());

  it('round-trips a valid deck through localStorage', () => {
    const deck = { ...createEmptyDeck(new Date('2026-01-01T00:00:00Z')), slides: splitLyrics('A\nB') };
    saveDeck(deck);
    expect(loadDeck()).toEqual(deck);
  });

  it('recovers safely from corrupt localStorage', () => {
    localStorage.setItem(DECK_STORAGE_KEY, '{bad');
    expect(loadDeck().slides).toEqual([]);
    localStorage.setItem('church-presenter:timer:v1', JSON.stringify({ version: 2, durationMs: -1, theme: 'pink' }));
    expect(loadTimerSettings()).toMatchObject({ version: 1, durationMs: 1_200_000, theme: 'black' });
  });
});

describe('validated deck import/export', () => {
  it('exports and imports a supported deck', () => {
    const deck = { ...createEmptyDeck(new Date('2026-01-01T00:00:00Z')), slides: splitLyrics('A\nB\nC') };
    expect(parseDeckImport(serializeDeck(deck, new Date('2026-01-02T00:00:00Z')))).toEqual(deck);
  });

  it('rejects malformed, foreign, unsupported, invalid, and oversized files', () => {
    expect(() => parseDeckImport('{')).toThrow('valid JSON');
    expect(() => parseDeckImport('{}')).toThrow('not exported');
    expect(() => parseDeckImport(JSON.stringify({ format: 'church-presenter', version: 3, deck: {} }))).toThrow('not supported');
    expect(() => parseDeckImport(JSON.stringify({ format: 'church-presenter', version: 1, deck: {} }))).toThrow('incomplete');
    expect(() => parseDeckImport(' '.repeat(MAX_IMPORT_BYTES + 1))).toThrow('2 MB');
  });

  it('rejects duplicate slide IDs and impossible selected positions', () => {
    const deck = { ...createEmptyDeck(new Date('2026-01-01T00:00:00Z')), slides: splitLyrics('A\nB\nC') };
    const duplicateIds = { ...deck, slides: deck.slides.map((slide) => ({ ...slide, id: deck.slides[0]!.id })) };
    const invalidPosition = { ...deck, currentIndex: 99 };
    const wrap = (value: unknown) => JSON.stringify({ format: 'church-presenter', version: 1, deck: value });
    expect(() => parseDeckImport(wrap(duplicateIds))).toThrow('incomplete');
    expect(() => parseDeckImport(wrap(invalidPosition))).toThrow('incomplete');
  });

  it('migrates version-one decks and keeps original white slides visually white', () => {
    const legacy = {
      version: 1,
      title: 'Old Sunday deck',
      sourceText: 'One\\nTwo',
      defaultTheme: 'green',
      slides: [
        { id: 'green-slide', lines: ['One'], themeOverride: null },
        { id: 'white-slide', lines: ['Two'], themeOverride: 'white' },
      ],
      currentIndex: 1,
      updatedAt: '2026-01-01T00:00:00.000Z',
    };
    localStorage.setItem(DECK_STORAGE_KEY, JSON.stringify(legacy));

    const migrated = loadDeck();
    expect(migrated.version).toBe(2);
    expect(migrated.defaultStyle).toMatchObject({ view: 'custom-color', color: '#00ff57' });
    expect(migrated.slides[1]?.styleOverride?.view).toBe('legacy-white');
    expect(JSON.parse(localStorage.getItem(DECK_STORAGE_KEY)!).version).toBe(2);

    const imported = parseDeckImport(JSON.stringify({ format: 'church-presenter', version: 1, deck: legacy }));
    expect(imported.slides[1]?.styleOverride?.view).toBe('legacy-white');
  });

  it('rejects unsafe custom colors and unknown church backgrounds', () => {
    const deck = createEmptyDeck();
    expect(() => parseDeckImport(JSON.stringify({
      format: 'church-presenter', version: 2,
      deck: { ...deck, defaultStyle: { ...deck.defaultStyle, color: 'url(javascript:alert(1))' } },
    }))).toThrow('incomplete');
    expect(() => parseDeckImport(JSON.stringify({
      format: 'church-presenter', version: 2,
      deck: { ...deck, defaultStyle: { ...deck.defaultStyle, backgroundId: '../other-file' } },
    }))).toThrow('incomplete');
  });
});
