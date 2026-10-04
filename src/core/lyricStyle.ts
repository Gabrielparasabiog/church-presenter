import type { ChurchBackgroundId, LyricSlide, LyricStyle, LyricView } from '../types';

export const LYRIC_VIEWS: ReadonlyArray<{ id: Exclude<LyricView, 'legacy-white'>; label: string; description: string }> = [
  { id: 'black-white', label: 'Black & White', description: 'White lyrics on a deep black screen.' },
  { id: 'custom-color', label: 'Custom Color', description: 'Choose a flat color with automatic text contrast.' },
  { id: 'dark-church', label: 'Dark 3D Church', description: 'A cinematic sanctuary backdrop for worship.' },
  { id: 'lower-third', label: 'Lower Third', description: 'White canvas with lyrics in a bold black band.' },
];

export const CHURCH_BACKGROUNDS: ReadonlyArray<{ id: ChurchBackgroundId; label: string; file: string }> = [
  { id: 'modern-amber', label: 'Amber stage', file: '01-modern-amber-stage.jpg' },
  { id: 'wooden-hall', label: 'Wooden worship hall', file: '02-wooden-worship-hall.jpg' },
  { id: 'violet-chapel', label: 'Violet chapel', file: '03-violet-chapel.jpg' },
  { id: 'teal-nave', label: 'Teal stone nave', file: '04-teal-stone-nave.jpg' },
  { id: 'blue-hour-glass', label: 'Glass chapel · blue hour', file: '05-glass-chapel-blue-hour.jpg' },
  { id: 'golden-vault', label: 'Golden vaulted chapel', file: '06-golden-vaulted-chapel.jpg' },
  { id: 'indigo-stage', label: 'Indigo worship stage', file: '07-indigo-worship-stage.jpg' },
  { id: 'blue-window', label: 'Blue window sanctuary', file: '08-blue-window-sanctuary.jpg' },
  { id: 'emerald-glass', label: 'Emerald stained glass', file: '09-emerald-stained-glass.jpg' },
  { id: 'midnight-timber', label: 'Midnight timber chapel', file: '10-midnight-timber-chapel.jpg' },
];

export const DEFAULT_CHURCH_BACKGROUND: ChurchBackgroundId = 'modern-amber';
export const DEFAULT_CUSTOM_COLOR = '#00ff57';

export function defaultLyricStyle(): LyricStyle {
  return { view: 'custom-color', color: DEFAULT_CUSTOM_COLOR, backgroundId: DEFAULT_CHURCH_BACKGROUND };
}

export function effectiveLyricStyle(slide: LyricSlide, deckStyle: LyricStyle): LyricStyle {
  return slide.styleOverride ?? deckStyle;
}

export function contrastingTextColor(hexColor: string): '#101713' | '#ffffff' {
  const match = /^#([\da-f]{2})([\da-f]{2})([\da-f]{2})$/iu.exec(hexColor);
  if (!match) return '#101713';
  const channels = match.slice(1).map((channel) => Number.parseInt(channel!, 16) / 255);
  const linear = channels.map((channel) => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4);
  const luminance = .2126 * linear[0]! + .7152 * linear[1]! + .0722 * linear[2]!;
  return luminance > .179 ? '#101713' : '#ffffff';
}

export function churchBackgroundFile(id: ChurchBackgroundId): string {
  return CHURCH_BACKGROUNDS.find((background) => background.id === id)?.file ?? CHURCH_BACKGROUNDS[0]!.file;
}
