export type ThemeName = 'green' | 'black' | 'white';

export type LyricView = 'black-white' | 'custom-color' | 'dark-church' | 'lower-third' | 'legacy-white';
export type ChurchBackgroundId =
  | 'modern-amber'
  | 'wooden-hall'
  | 'violet-chapel'
  | 'teal-nave'
  | 'blue-hour-glass'
  | 'golden-vault'
  | 'indigo-stage'
  | 'blue-window'
  | 'emerald-glass'
  | 'midnight-timber';

export interface LyricStyle {
  view: LyricView;
  color: string;
  backgroundId: ChurchBackgroundId;
}

export interface LyricSlide {
  id: string;
  lines: [string] | [string, string];
  styleOverride: LyricStyle | null;
}

export interface LyricDeck {
  version: 2;
  title: string;
  sourceText: string;
  defaultStyle: LyricStyle;
  slides: LyricSlide[];
  currentIndex: number;
  updatedAt: string;
}

export interface TimerSettings {
  version: 1;
  durationMs: number;
  theme: ThemeName;
}

export interface ChurchPresenterExport {
  format: 'church-presenter';
  version: 1 | 2;
  exportedAt: string;
  deck: LyricDeck;
}
