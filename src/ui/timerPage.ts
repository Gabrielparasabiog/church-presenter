import { byId, isEditableTarget, toggleFullscreen } from '../core/dom';
import {
  createTimerState,
  durationFromParts,
  durationParts,
  formatDuration,
  pauseTimer,
  resetTimer,
  setTimerDuration,
  startNextLoop,
  startTimer,
  tickTimer,
  type TimerState,
} from '../core/timer';
import { loadTimerSettings, saveTimerSettings } from '../core/storage';
import { ScreenWakeLock } from '../core/wakeLock';
import type { ThemeName } from '../types';
import { pageShell, themeOptions, type PageCleanup } from './shell';

export function renderTimerPage(root: HTMLElement): PageCleanup {
  let settings = loadTimerSettings();
  let state: TimerState = createTimerState(settings.durationMs);
  const wakeLock = new ScreenWakeLock();
  const parts = durationParts(settings.durationMs);

  root.innerHTML = pageShell(
    'Countdown Timer',
    'Set the room before the first note',
    `<section class="timer-workspace">
      <div id="timer-stage" class="timer-stage theme-${settings.theme}" aria-label="Countdown display">
        <div class="timer-stage-inner">
          <p id="timer-state-label" role="status" aria-live="polite">Ready when you are</p>
          <output id="timer-output" role="timer" aria-label="Time remaining">${formatDuration(state.remainingMs)}</output>
          <p id="timer-finish-note" class="timer-finish-note" hidden>Time is complete. Start the next loop when the room is ready.</p>
        </div>
        <p class="stage-shortcuts" aria-hidden="true">Space · start/pause &nbsp; R · reset &nbsp; F · fullscreen</p>
      </div>
      <aside class="control-card timer-controls" aria-label="Timer controls">
        <div class="control-section">
          <p class="control-label">Duration</p>
          <div class="duration-fields">
            <label><span>Hours</span><input id="timer-hours" inputmode="numeric" type="number" min="0" max="23" value="${parts.hours}" /></label>
            <span aria-hidden="true">:</span>
            <label><span>Minutes</span><input id="timer-minutes" inputmode="numeric" type="number" min="0" max="59" value="${parts.minutes}" /></label>
            <span aria-hidden="true">:</span>
            <label><span>Seconds</span><input id="timer-seconds" inputmode="numeric" type="number" min="0" max="59" value="${parts.seconds}" /></label>
          </div>
        </div>
        <div class="control-section">
          <label class="select-label" for="timer-theme">Screen background</label>
          <select id="timer-theme">${themeOptions(settings.theme)}</select>
          <p class="helper-text">Text color changes automatically for contrast.</p>
        </div>
        <div class="button-stack">
          <button id="timer-primary" class="button button-primary" type="button">Start countdown</button>
          <button id="timer-reset" class="button button-secondary" type="button">Reset</button>
          <button id="timer-fullscreen" class="button button-quiet" type="button">Enter fullscreen</button>
        </div>
        <p class="silent-badge"><span aria-hidden="true">◌</span> Always silent · display stays awake while running</p>
      </aside>
    </section>`,
    'timer',
  );

  const stage = byId<HTMLDivElement>('timer-stage');
  const output = byId<HTMLOutputElement>('timer-output');
  const stateLabel = byId<HTMLParagraphElement>('timer-state-label');
  const finishNote = byId<HTMLParagraphElement>('timer-finish-note');
  const primary = byId<HTMLButtonElement>('timer-primary');
  const reset = byId<HTMLButtonElement>('timer-reset');
  const fullscreen = byId<HTMLButtonElement>('timer-fullscreen');
  const hours = byId<HTMLInputElement>('timer-hours');
  const minutes = byId<HTMLInputElement>('timer-minutes');
  const seconds = byId<HTMLInputElement>('timer-seconds');
  const theme = byId<HTMLSelectElement>('timer-theme');
  let renderedTime = '';
  let renderedPhase = '';

  const syncSettings = (): void => {
    const durationMs = durationFromParts(hours.valueAsNumber, minutes.valueAsNumber, seconds.valueAsNumber);
    settings = { version: 1, durationMs, theme: theme.value as ThemeName };
    saveTimerSettings(settings);
    if (state.phase === 'idle') state = setTimerDuration(durationMs);
  };

  const render = (): void => {
    const displayedTime = formatDuration(state.remainingMs);
    output.value = displayedTime;
    output.textContent = displayedTime;
    stage.className = `timer-stage theme-${settings.theme} ${state.phase === 'complete' ? 'is-complete' : ''}`;
    finishNote.hidden = state.phase !== 'complete';
    const labels = {
      idle: 'Ready when you are',
      running: 'Countdown in progress',
      paused: 'Paused',
      complete: 'Time complete',
    };
    stateLabel.textContent = labels[state.phase];
    primary.textContent = state.phase === 'complete' ? 'Start next loop' : state.phase === 'running' ? 'Pause' : state.phase === 'paused' ? 'Resume' : 'Start countdown';
    [hours, minutes, seconds].forEach((input) => { input.disabled = state.phase === 'running' || state.phase === 'paused'; });
    fullscreen.textContent = document.fullscreenElement ? 'Exit fullscreen' : 'Enter fullscreen';
    renderedTime = displayedTime;
    renderedPhase = state.phase;
  };

  const onPrimary = (): void => {
    const now = Date.now();
    if (state.phase === 'complete') state = startNextLoop(state, now);
    else if (state.phase === 'running') state = pauseTimer(state, now);
    else {
      syncSettings();
      state = startTimer(state, now);
    }
    if (state.phase === 'running') void wakeLock.start();
    else void wakeLock.stop();
    render();
  };
  const onReset = (): void => { state = resetTimer(state); void wakeLock.stop(); render(); };
  const onInput = (): void => { syncSettings(); render(); };
  const onTheme = (): void => { syncSettings(); render(); };
  const onFullscreen = (): void => { void toggleFullscreen(stage).catch(() => undefined); };
  const onFullscreenChange = (): void => { fullscreen.textContent = document.fullscreenElement ? 'Exit fullscreen' : 'Enter fullscreen'; };
  const onKeyDown = (event: KeyboardEvent): void => {
    if (event.repeat || isEditableTarget(event.target)) return;
    const key = event.key.toLowerCase();
    if (event.key === ' ') {
      event.preventDefault();
      onPrimary();
    } else if (key === 'r') {
      event.preventDefault();
      onReset();
    } else if (key === 'f') {
      event.preventDefault();
      onFullscreen();
    }
  };
  const interval = window.setInterval(() => {
    const next = tickTimer(state, Date.now());
    if (next !== state) {
      state = next;
      const nextTime = formatDuration(state.remainingMs);
      if (nextTime !== renderedTime || state.phase !== renderedPhase) render();
      if (state.phase === 'complete') void wakeLock.stop();
    }
  }, 200);

  primary.addEventListener('click', onPrimary);
  reset.addEventListener('click', onReset);
  fullscreen.addEventListener('click', onFullscreen);
  stage.addEventListener('dblclick', onFullscreen);
  document.addEventListener('keydown', onKeyDown);
  document.addEventListener('fullscreenchange', onFullscreenChange);
  [hours, minutes, seconds].forEach((input) => input.addEventListener('change', onInput));
  theme.addEventListener('change', onTheme);
  render();

  return () => {
    window.clearInterval(interval);
    primary.removeEventListener('click', onPrimary);
    reset.removeEventListener('click', onReset);
    fullscreen.removeEventListener('click', onFullscreen);
    document.removeEventListener('keydown', onKeyDown);
    document.removeEventListener('fullscreenchange', onFullscreenChange);
    wakeLock.destroy();
  };
}
