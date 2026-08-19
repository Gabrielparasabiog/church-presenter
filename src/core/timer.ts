export type TimerPhase = 'idle' | 'running' | 'paused' | 'complete';

export interface TimerState {
  durationMs: number;
  remainingMs: number;
  phase: TimerPhase;
  targetEndMs: number | null;
}

export function createTimerState(durationMs: number): TimerState {
  const safeDuration = Math.max(1_000, Math.floor(durationMs));
  return { durationMs: safeDuration, remainingMs: safeDuration, phase: 'idle', targetEndMs: null };
}

export function startTimer(state: TimerState, nowMs: number): TimerState {
  if (state.phase === 'running' || state.phase === 'complete') return state;
  return { ...state, phase: 'running', targetEndMs: nowMs + state.remainingMs };
}

export function tickTimer(state: TimerState, nowMs: number): TimerState {
  if (state.phase !== 'running' || state.targetEndMs === null) return state;
  const remainingMs = Math.max(0, state.targetEndMs - nowMs);
  if (remainingMs === 0) return { ...state, remainingMs: 0, phase: 'complete', targetEndMs: null };
  return { ...state, remainingMs };
}

export function pauseTimer(state: TimerState, nowMs: number): TimerState {
  const current = tickTimer(state, nowMs);
  if (current.phase !== 'running') return current;
  return { ...current, phase: 'paused', targetEndMs: null };
}

export function resetTimer(state: TimerState): TimerState {
  return createTimerState(state.durationMs);
}

export function setTimerDuration(durationMs: number): TimerState {
  return createTimerState(durationMs);
}

export function startNextLoop(state: TimerState, nowMs: number): TimerState {
  if (state.phase !== 'complete') return state;
  return { ...state, remainingMs: state.durationMs, phase: 'running', targetEndMs: nowMs + state.durationMs };
}

export function formatDuration(milliseconds: number): string {
  const totalSeconds = Math.max(0, Math.ceil(milliseconds / 1_000));
  const hours = Math.floor(totalSeconds / 3_600);
  const minutes = Math.floor((totalSeconds % 3_600) / 60);
  const seconds = totalSeconds % 60;
  const hh = hours > 0 ? `${String(hours).padStart(2, '0')}:` : '';
  return `${hh}${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export function durationFromParts(hours: number, minutes: number, seconds: number): number {
  const safeHours = Math.max(0, Math.min(23, Math.floor(hours || 0)));
  const safeMinutes = Math.max(0, Math.min(59, Math.floor(minutes || 0)));
  const safeSeconds = Math.max(0, Math.min(59, Math.floor(seconds || 0)));
  return Math.max(1, safeHours * 3_600 + safeMinutes * 60 + safeSeconds) * 1_000;
}

export function durationParts(milliseconds: number): { hours: number; minutes: number; seconds: number } {
  const totalSeconds = Math.floor(milliseconds / 1_000);
  return {
    hours: Math.floor(totalSeconds / 3_600),
    minutes: Math.floor((totalSeconds % 3_600) / 60),
    seconds: totalSeconds % 60,
  };
}
