import '@fontsource/cormorant-garamond/latin-600.css';
import '@fontsource/cormorant-garamond/latin-ext-600.css';
import '@fontsource/cormorant-garamond/latin-700.css';
import '@fontsource/cormorant-garamond/latin-ext-700.css';
import '@fontsource/source-sans-3/latin-400.css';
import '@fontsource/source-sans-3/latin-ext-400.css';
import '@fontsource/source-sans-3/latin-600.css';
import '@fontsource/source-sans-3/latin-ext-600.css';
import '@fontsource/source-sans-3/latin-700.css';
import '@fontsource/source-sans-3/latin-ext-700.css';
import { registerSW } from 'virtual:pwa-register';
import './styles.css';
import { renderHome } from './ui/home';
import { renderLyricsPage } from './ui/lyricsPage';
import type { PageCleanup } from './ui/shell';
import { renderTimerPage } from './ui/timerPage';

const root = document.querySelector<HTMLElement>('#app');
if (!root) throw new Error('Application root was not found.');

let cleanup: PageCleanup | undefined;

function renderRoute(): void {
  cleanup?.();
  cleanup = undefined;
  const route = window.location.hash.replace(/^#/, '') || '/';
  if (route === '/timer') cleanup = renderTimerPage(root!);
  else if (route === '/lyrics') cleanup = renderLyricsPage(root!);
  else renderHome(root!);
  window.scrollTo({ top: 0, behavior: 'instant' });
}

window.addEventListener('hashchange', renderRoute);
renderRoute();

const updateSW = registerSW({
  onNeedRefresh() {
    if (document.querySelector('[data-update-toast]')) return;
    const toast = document.createElement('div');
    toast.className = 'update-toast';
    toast.dataset.updateToast = '';
    toast.setAttribute('role', 'status');
    toast.innerHTML = '<span>A new version is ready.</span><button type="button">Update now</button>';
    toast.querySelector('button')?.addEventListener('click', () => { void updateSW(true); });
    document.body.append(toast);
  },
  onOfflineReady() {
    if (document.querySelector('[data-offline-toast]')) return;
    const toast = document.createElement('div');
    toast.className = 'update-toast offline-toast';
    toast.dataset.offlineToast = '';
    toast.setAttribute('role', 'status');
    toast.textContent = 'Church Presenter is ready to use offline.';
    document.body.append(toast);
    window.setTimeout(() => toast.remove(), 4_000);
  },
});
