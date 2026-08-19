import { describe, expect, it } from 'vitest';
import {
  createTimerState,
  durationFromParts,
  formatDuration,
  pauseTimer,
  resetTimer,
  startNextLoop,
  startTimer,
  tickTimer,
} from '../core/timer';

describe('countdown timer', () => {
  it('uses an absolute target so hidden-tab delays do not create drift', () => {
    const started = startTimer(createTimerState(20_000), 1_000);
    expect(tickTimer(started, 6_000).remainingMs).toBe(15_000);
    expect(tickTimer(started, 20_500).remainingMs).toBe(500);
  });

  it('pauses and resumes from the exact remaining time', () => {
    const started = startTimer(createTimerState(10_000), 1_000);
    const paused = pauseTimer(started, 4_000);
    expect(paused.phase).toBe('paused');
    expect(paused.remainingMs).toBe(7_000);
    const resumed = startTimer(paused, 20_000);
    expect(tickTimer(resumed, 23_000).remainingMs).toBe(4_000);
  });

  it('stays at zero until Start Next Loop is used', () => {
    const complete = tickTimer(startTimer(createTimerState(5_000), 0), 8_000);
    expect(complete.phase).toBe('complete');
    expect(complete.remainingMs).toBe(0);
    expect(startTimer(complete, 9_000)).toBe(complete);
    const next = startNextLoop(complete, 9_000);
    expect(next.phase).toBe('running');
    expect(next.remainingMs).toBe(5_000);
    expect(next.targetEndMs).toBe(14_000);
  });

  it('resets to the original duration', () => {
    const running = tickTimer(startTimer(createTimerState(8_000), 0), 3_000);
    expect(resetTimer(running)).toEqual(createTimerState(8_000));
  });

  it('formats durations and clamps user parts', () => {
    expect(formatDuration(20 * 60_000)).toBe('20:00');
    expect(formatDuration(3_661_000)).toBe('01:01:01');
    expect(durationFromParts(2, 90, -5)).toBe((2 * 3_600 + 59 * 60) * 1_000);
  });
});
