import { afterEach, describe, expect, it, vi } from 'vitest';
import { ScreenWakeLock } from '../core/wakeLock';

class FakeWakeLockSentinel extends EventTarget {
  released = false;

  async release(): Promise<void> {
    this.released = true;
    this.dispatchEvent(new Event('release'));
  }
}

describe('screen wake lock', () => {
  const originalWakeLock = Object.getOwnPropertyDescriptor(navigator, 'wakeLock');

  afterEach(() => {
    if (originalWakeLock) Object.defineProperty(navigator, 'wakeLock', originalWakeLock);
    else Reflect.deleteProperty(navigator, 'wakeLock');
    vi.restoreAllMocks();
  });

  it('acquires and releases the screen lock for an active presentation', async () => {
    const sentinel = new FakeWakeLockSentinel();
    const request = vi.fn(async () => sentinel);
    Object.defineProperty(navigator, 'wakeLock', { configurable: true, value: { request } });

    const lock = new ScreenWakeLock();
    await expect(lock.start()).resolves.toBe(true);
    expect(request).toHaveBeenCalledWith('screen');
    expect(sentinel.released).toBe(false);

    await lock.stop();
    expect(sentinel.released).toBe(true);
    lock.destroy();
  });

  it('degrades safely when the browser does not support wake lock', async () => {
    Reflect.deleteProperty(navigator, 'wakeLock');
    const lock = new ScreenWakeLock();
    expect(lock.isSupported).toBe(false);
    await expect(lock.start()).resolves.toBe(false);
    lock.destroy();
  });
});
