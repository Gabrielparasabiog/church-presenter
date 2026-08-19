import { pageShell } from './shell';

export function renderHome(root: HTMLElement): void {
  root.innerHTML = pageShell(
    'Lead the room without distraction.',
    'Worship tools for the moment',
    `<section class="home-hero">
      <div class="hero-copy">
        <p class="hero-kicker">Quiet tools. Clear words. Faithful timing.</p>
        <p class="hero-intro">Prepare a countdown or turn a complete song into clean two-line slides—then present it from this browser, even when the connection disappears.</p>
      </div>
      <div class="sanctuary-window" aria-hidden="true"><span class="window-cross"></span><span class="window-glow"></span></div>
    </section>
    <section class="mode-grid" aria-label="Choose a presentation tool">
      <a class="mode-card timer-card" href="#/timer">
        <span class="mode-number">01</span>
        <div class="mode-symbol timer-symbol" aria-hidden="true"><span>20</span><small>MIN</small></div>
        <div>
          <p class="eyebrow">Service countdown</p>
          <h2>Countdown Timer</h2>
          <p>Set the room, choose a screen color, and keep every loop silent and exact.</p>
        </div>
        <span class="card-action">Open timer <b aria-hidden="true">→</b></span>
      </a>
      <a class="mode-card lyrics-card" href="#/lyrics">
        <span class="mode-number">02</span>
        <div class="mode-symbol lyric-symbol" aria-hidden="true"><span>“</span></div>
        <div>
          <p class="eyebrow">Two lines at a time</p>
          <h2>Lyrics Presenter</h2>
          <p>Paste the whole song, refine each slide, and present it like a focused deck.</p>
        </div>
        <span class="card-action">Create slides <b aria-hidden="true">→</b></span>
      </a>
    </section>
    <section class="privacy-note">
      <span aria-hidden="true">✦</span>
      <p><strong>Your service stays yours.</strong> Lyrics and settings are stored only in this browser. Nothing is uploaded.</p>
    </section>`,
  );
}
