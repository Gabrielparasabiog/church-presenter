import type { ChurchPresenterExport, ChurchBackgroundId, LyricDeck, LyricSlide, LyricStyle, LyricView, ThemeName, TimerSettings } from '../types';
import { MAX_LINE_LENGTH, MAX_SLIDES } from './lyrics';
import { CHURCH_BACKGROUNDS, defaultLyricStyle } from './lyricStyle';

export const TIMER_STORAGE_KEY = 'church-presenter:timer:v1';
export const DECK_STORAGE_KEY = 'church-presenter:deck:v1';
export const MAX_IMPORT_BYTES = 2_000_000;

const themes: ThemeName[] = ['green', 'black', 'white'];
const views: LyricView[] = ['black-white', 'custom-color', 'dark-church', 'lower-third', 'legacy-white'];
const backgroundIds = CHURCH_BACKGROUNDS.map(({ id }) => id);
const isTheme = (value: unknown): value is ThemeName => typeof value === 'string' && themes.includes(value as ThemeName);
const isLyricStyle = (value: unknown): value is LyricStyle => {
  if (!value || typeof value !== 'object') return false;
  const style = value as Partial<LyricStyle>;
  return typeof style.view === 'string' && views.includes(style.view) &&
    typeof style.color === 'string' && /^#[\da-f]{6}$/iu.test(style.color) &&
    typeof style.backgroundId === 'string' && backgroundIds.includes(style.backgroundId as ChurchBackgroundId);
};

function styleFromLegacyTheme(theme: ThemeName): LyricStyle {
  const style = defaultLyricStyle();
  if (theme === 'black') return { ...style, view: 'black-white' };
  if (theme === 'white') return { ...style, view: 'legacy-white' };
  return style;
}

function isLegacyDeck(value: unknown): value is {
  version: 1; title: string; sourceText: string; defaultTheme: ThemeName;
  slides: Array<Pick<LyricSlide, 'id' | 'lines'> & { themeOverride: ThemeName | null }>;
  currentIndex: number; updatedAt: string;
} {
  if (!value || typeof value !== 'object') return false;
  const deck = value as Record<string, unknown>;
  if (deck.version !== 1 || typeof deck.title !== 'string' || deck.title.length > 200 ||
      typeof deck.sourceText !== 'string' || deck.sourceText.length > MAX_IMPORT_BYTES ||
      !isTheme(deck.defaultTheme) || !Array.isArray(deck.slides) || deck.slides.length > MAX_SLIDES ||
      !Number.isInteger(deck.currentIndex) || Number(deck.currentIndex) < 0 ||
      Number(deck.currentIndex) > Math.max(0, deck.slides.length - 1) ||
      typeof deck.updatedAt !== 'string' || Number.isNaN(Date.parse(deck.updatedAt))) return false;
  const ids = new Set<string>();
  for (const item of deck.slides) {
    if (!item || typeof item !== 'object') return false;
    const slide = item as Record<string, unknown>;
    if (typeof slide.id !== 'string' || !slide.id.length || slide.id.length > 120 || ids.has(slide.id) ||
        !Array.isArray(slide.lines) || slide.lines.length < 1 || slide.lines.length > 2 ||
        !slide.lines.every((line) => typeof line === 'string' && line.length <= MAX_LINE_LENGTH) ||
        !(slide.themeOverride === null || isTheme(slide.themeOverride))) return false;
    ids.add(slide.id);
  }
  return true;
}

function migrateLegacyDeck(deck: unknown): LyricDeck | null {
  if (!isLegacyDeck(deck)) return null;
  return {
    version: 2,
    title: deck.title,
    sourceText: deck.sourceText,
    defaultStyle: styleFromLegacyTheme(deck.defaultTheme),
    slides: deck.slides.map((slide) => ({
      id: slide.id,
      lines: [...slide.lines] as LyricSlide['lines'],
      styleOverride: slide.themeOverride === null ? null : styleFromLegacyTheme(slide.themeOverride),
    })),
    currentIndex: deck.currentIndex,
    updatedAt: deck.updatedAt,
  };
}

export function createEmptyDeck(now = new Date()): LyricDeck {
  return {
    version: 2,
    title: 'Sunday Worship',
    sourceText: '',
    defaultStyle: defaultLyricStyle(),
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
    (slide.styleOverride === null || isLyricStyle(slide.styleOverride))
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
    deck.version === 2 &&
    typeof deck.title === 'string' && deck.title.length <= 200 &&
    typeof deck.sourceText === 'string' && deck.sourceText.length <= MAX_IMPORT_BYTES &&
    isLyricStyle(deck.defaultStyle) &&
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
    if (isDeck(parsed)) return parsed;
    const migrated = migrateLegacyDeck(parsed);
    if (!migrated) return createEmptyDeck();
    try { saveDeck(migrated, storage); } catch { /* Keep the readable legacy deck for this session. */ }
    return migrated;
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
    version: 2,
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
  if (payload.version !== 1 && payload.version !== 2) throw new Error('This deck version is not supported.');
  if (isDeck(payload.deck)) return payload.deck;
  const migrated = migrateLegacyDeck(payload.deck);
  if (migrated) return migrated;
  throw new Error('The deck is incomplete or contains invalid slides.');
}
