export type ThemeName = 'green' | 'black' | 'white';

export interface LyricSlide {
  id: string;
  lines: [string] | [string, string];
  themeOverride: ThemeName | null;
}

export interface LyricDeck {
  version: 1;
  title: string;
  sourceText: string;
  defaultTheme: ThemeName;
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
  version: 1;
  exportedAt: string;
  deck: LyricDeck;
}
