import { escapeHtml } from '../core/dom';

export type PageCleanup = () => void;

const icon = (name: 'home' | 'timer' | 'lyrics'): string => {
  const paths = {
    home: '<path d="M3 11.5 12 4l9 7.5v8a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 19.5z"/><path d="M9 21v-6h6v6"/>',
    timer: '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l3 2M9 2h6M12 5V2"/>',
    lyrics: '<path d="M6 3h12v18H6z"/><path d="M9 8h6M9 12h6M9 16h4"/>',
  };
  return `<svg aria-hidden="true" viewBox="0 0 24 24">${paths[name]}</svg>`;
};

export function pageShell(title: string, eyebrow: string, content: string, active?: 'timer' | 'lyrics'): string {
  return `
    <div class="app-shell">
      <header class="site-header">
        <a class="brand" href="#/" aria-label="Church Presenter home">
          <span class="brand-mark" aria-hidden="true"><span></span></span>
          <span><strong>Church Presenter</strong><small>Prepared with purpose</small></span>
        </a>
        <nav aria-label="Primary navigation">
          <a href="#/" class="nav-link">${icon('home')}<span>Home</span></a>
          <a href="#/timer" class="nav-link ${active === 'timer' ? 'is-active' : ''}">${icon('timer')}<span>Timer</span></a>
          <a href="#/lyrics" class="nav-link ${active === 'lyrics' ? 'is-active' : ''}">${icon('lyrics')}<span>Lyrics</span></a>
        </nav>
      </header>
      <main id="main-content" tabindex="-1">
        <section class="page-heading">
          <p class="eyebrow">${escapeHtml(eyebrow)}</p>
          <h1>${escapeHtml(title)}</h1>
        </section>
        ${content}
      </main>
    </div>`;
}

export function themeOptions(selected: string, includeInherit = false): string {
  const options = [
    ...(includeInherit ? [{ value: 'inherit', label: 'Use deck theme' }] : []),
    { value: 'green', label: 'Chroma green' },
    { value: 'black', label: 'Black' },
    { value: 'white', label: 'White' },
  ];
  return options.map(({ value, label }) => `<option value="${value}" ${value === selected ? 'selected' : ''}>${label}</option>`).join('');
}
