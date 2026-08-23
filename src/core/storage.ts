import type { ChurchPresenterExport, LyricDeck, LyricSlide, ThemeName, TimerSettings } from '../types';
import { MAX_LINE_LENGTH, MAX_SLIDES } from './lyrics';

export const TIMER_STORAGE_KEY = 'church-presenter:timer:v1';
export const DECK_STORAGE_KEY = 'church-presenter:deck:v1';
export const MAX_IMPORT_BYTES = 2_000_000;

const themes: ThemeName[] = ['green', 'black', 'white'];
const isTheme = (value: unknown): value is ThemeName => typeof value === 'string' && themes.includes(value as ThemeName);

export function createEmptyDeck(now = new Date()): LyricDeck {
  return {
    version: 1,
    title: 'Sunday Worship',
    sourceText: '',
    defaultTheme: 'green',
    slides: [],
    currentIndex: 0,
    updatedAt: now.toISOString(),
  };
}

export function defaultTimerSettings(): TimerSettings {
  return { version: 1, durationMs: 20 * 60 * 1_000, theme: 'black' };
}

function isSlide(value: unknown): value is LyricSlide {
  if (!value || typeof value !== 'object') return false;
  const slide = value as Partial<LyricSlide>;
  return (
    typeof slide.id === 'string' && slide.id.length > 0 && slide.id.length <= 120 &&
    Array.isArray(slide.lines) && slide.lines.length >= 1 && slide.lines.length <= 2 &&
    slide.lines.every((line) => typeof line === 'string' && line.length <= MAX_LINE_LENGTH) &&
    (slide.themeOverride === null || isTheme(slide.themeOverride))
  );
}

export function isDeck(value: unknown): value is LyricDeck {
  if (!value || typeof value !== 'object') return false;
  const deck = value as Partial<LyricDeck>;
  const slidesAreValid = Array.isArray(deck.slides) &&
    deck.slides.length <= MAX_SLIDES &&
    deck.slides.every(isSlide) &&
    new Set(deck.slides.map((slide) => slide.id)).size === deck.slides.length;
  const currentIndexIsValid = Number.isInteger(deck.currentIndex) &&
    Number(deck.currentIndex) >= 0 &&
    Number(deck.currentIndex) <= (Array.isArray(deck.slides) ? Math.max(0, deck.slides.length - 1) : 0);
  return (
    deck.version === 1 &&
    typeof deck.title === 'string' && deck.title.length <= 200 &&
    typeof deck.sourceText === 'string' && deck.sourceText.length <= MAX_IMPORT_BYTES &&
    isTheme(deck.defaultTheme) &&
    slidesAreValid &&
    currentIndexIsValid &&
    typeof deck.updatedAt === 'string' && !Number.isNaN(Date.parse(deck.updatedAt))
  );
}

export function loadDeck(storage: Storage = localStorage): LyricDeck {
  try {
    const raw = storage.getItem(DECK_STORAGE_KEY);
    if (!raw) return createEmptyDeck();
    const parsed: unknown = JSON.parse(raw);
    return isDeck(parsed) ? parsed : createEmptyDeck();
  } catch {
    return createEmptyDeck();
  }
}

export function saveDeck(deck: LyricDeck, storage: Storage = localStorage): void {
  storage.setItem(DECK_STORAGE_KEY, JSON.stringify(deck));
}

export function loadTimerSettings(storage: Storage = localStorage): TimerSettings {
  try {
    const raw = storage.getItem(TIMER_STORAGE_KEY);
    if (!raw) return defaultTimerSettings();
    const parsed = JSON.parse(raw) as Partial<TimerSettings>;
    if (parsed.version !== 1 || !Number.isFinite(parsed.durationMs) || Number(parsed.durationMs) < 1_000 || !isTheme(parsed.theme)) {
      return defaultTimerSettings();
    }
    return parsed as TimerSettings;
  } catch {
    return defaultTimerSettings();
  }
}

export function saveTimerSettings(settings: TimerSettings, storage: Storage = localStorage): void {
  storage.setItem(TIMER_STORAGE_KEY, JSON.stringify(settings));
}

export function serializeDeck(deck: LyricDeck, now = new Date()): string {
  const payload: ChurchPresenterExport = {
    format: 'church-presenter',
    version: 1,
    exportedAt: now.toISOString(),
    deck,
  };
  return JSON.stringify(payload, null, 2);
}

export function parseDeckImport(raw: string): LyricDeck {
  if (new Blob([raw]).size > MAX_IMPORT_BYTES) throw new Error('This file is larger than the 2 MB import limit.');
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('This is not valid JSON.');
  }
  if (!parsed || typeof parsed !== 'object') throw new Error('The file does not contain a Church Presenter deck.');
  const payload = parsed as Partial<ChurchPresenterExport>;
  if (payload.format !== 'church-presenter') throw new Error('This file was not exported by Church Presenter.');
  if (payload.version !== 1) throw new Error('This deck version is not supported.');
  if (!isDeck(payload.deck)) throw new Error('The deck is incomplete or contains invalid slides.');
  return payload.deck;
}
