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
    expect(() => parseDeckImport(JSON.stringify({ format: 'church-presenter', version: 2, deck: {} }))).toThrow('not supported');
    expect(() => parseDeckImport(JSON.stringify({ format: 'church-presenter', version: 1, deck: {} }))).toThrow('incomplete');
    expect(() => parseDeckImport(' '.repeat(MAX_IMPORT_BYTES + 1))).toThrow('2 MB');
  });
});
