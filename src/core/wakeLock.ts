interface WakeLockSentinelLike extends EventTarget {
  readonly released: boolean;
  release(): Promise<void>;
}

interface WakeLockProvider {
  request(type: 'screen'): Promise<WakeLockSentinelLike>;
}

type NavigatorWithWakeLock = Navigator & { wakeLock?: WakeLockProvider };

/** Keeps a projector or mobile display awake only while a presentation is active. */
export class ScreenWakeLock {
  private requested = false;
  private sentinel: WakeLockSentinelLike | null = null;

  constructor() {
    document.addEventListener('visibilitychange', this.onVisibilityChange);
  }

  get isSupported(): boolean {
    return Boolean((navigator as NavigatorWithWakeLock).wakeLock);
  }

  async start(): Promise<boolean> {
    this.requested = true;
    return this.acquire();
  }

  async stop(): Promise<void> {
    this.requested = false;
    const sentinel = this.sentinel;
    this.sentinel = null;
    if (sentinel && !sentinel.released) {
      try {
        await sentinel.release();
      } catch {
        // The browser may release the lock first when the tab is hidden.
      }
    }
  }

  destroy(): void {
    document.removeEventListener('visibilitychange', this.onVisibilityChange);
    void this.stop();
  }

  private readonly onVisibilityChange = (): void => {
    if (document.visibilityState === 'visible' && this.requested && !this.sentinel) {
      void this.acquire();
    }
  };

  private async acquire(): Promise<boolean> {
    const provider = (navigator as NavigatorWithWakeLock).wakeLock;
    if (!provider || !this.requested || document.visibilityState !== 'visible') return false;
    if (this.sentinel && !this.sentinel.released) return true;
    try {
      const sentinel = await provider.request('screen');
      if (!this.requested) {
        await sentinel.release();
        return false;
      }
      this.sentinel = sentinel;
      sentinel.addEventListener('release', () => {
        if (this.sentinel === sentinel) this.sentinel = null;
      }, { once: true });
      return true;
    } catch {
      this.sentinel = null;
      return false;
    }
  }
}
