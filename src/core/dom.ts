export function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

export function byId<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Missing element #${id}`);
  return element as T;
}

export function isEditableTarget(target: EventTarget | null): boolean {
  const element = target instanceof HTMLElement ? target : null;
  return Boolean(element?.isContentEditable || element?.closest('input, textarea, select, button, a'));
}

export function fitText(element: HTMLElement, maxPx = 92, minPx = 24): void {
  if (element.clientWidth <= 0 || element.clientHeight <= 0) return;
  const styles = window.getComputedStyle(element);
  const availableWidth = element.clientWidth -
    (Number.parseFloat(styles.paddingLeft) || 0) -
    (Number.parseFloat(styles.paddingRight) || 0);
  const availableHeight = element.clientHeight -
    (Number.parseFloat(styles.paddingTop) || 0) -
    (Number.parseFloat(styles.paddingBottom) || 0);
  const lines = Array.from(element.children, (child) => child.textContent ?? '');
  if (!lines.length || availableWidth <= 0 || availableHeight <= 0) return;

  const probeSize = 100;
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  let widthLimit: number;
  if (context) {
    context.font = `${styles.fontStyle} ${styles.fontWeight} ${probeSize}px ${styles.fontFamily}`;
    const widestAtProbeSize = Math.max(...lines.map((line) => context.measureText(line).width), 1);
    widthLimit = availableWidth * probeSize / widestAtProbeSize;
  } else {
    const longestLine = Math.max(...lines.map((line) => line.length), 1);
    widthLimit = availableWidth / (longestLine * 0.58);
  }

  const currentFontSize = Number.parseFloat(styles.fontSize) || maxPx;
  const computedLineHeight = Number.parseFloat(styles.lineHeight);
  const lineHeightRatio = Number.isFinite(computedLineHeight) ? computedLineHeight / currentFontSize : 1.15;
  const heightLimit = availableHeight / (lines.length * Math.max(1, lineHeightRatio));
  const best = Math.max(minPx, Math.min(maxPx, Math.floor(widthLimit), Math.floor(heightLimit)));
  element.style.fontSize = `${best}px`;
}

export function downloadText(filename: string, contents: string): void {
  const url = URL.createObjectURL(new Blob([contents], { type: 'application/json' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

export async function enterFullscreen(element: HTMLElement): Promise<void> {
  if (!document.fullscreenElement && element.requestFullscreen) {
    await element.requestFullscreen();
  }
}

export async function exitFullscreen(): Promise<void> {
  if (document.fullscreenElement && document.exitFullscreen) await document.exitFullscreen();
}

export async function toggleFullscreen(element: HTMLElement): Promise<void> {
  if (document.fullscreenElement) await exitFullscreen();
  else await enterFullscreen(element);
}
