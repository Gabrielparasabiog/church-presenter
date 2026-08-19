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

export function fitText(element: HTMLElement, maxPx = 92, minPx = 24): void {
  const fitsInside = (): boolean => {
    const container = element.getBoundingClientRect();
    const children = Array.from(element.children).map((child) => child.getBoundingClientRect());
    return (
      element.scrollHeight <= element.clientHeight + 1 &&
      element.scrollWidth <= element.clientWidth + 1 &&
      children.every((child) =>
        child.top >= container.top - 1 &&
        child.bottom <= container.bottom + 1 &&
        child.left >= container.left - 1 &&
        child.right <= container.right + 1)
    );
  };
  let size = maxPx;
  element.style.fontSize = `${size}px`;
  while (!fitsInside() && size > minPx) {
    size -= 2;
    element.style.fontSize = `${size}px`;
  }
}

export function downloadText(filename: string, contents: string): void {
  const url = URL.createObjectURL(new Blob([contents], { type: 'application/json' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export async function enterFullscreen(element: HTMLElement): Promise<void> {
  if (!document.fullscreenElement && element.requestFullscreen) {
    await element.requestFullscreen();
  }
}

export async function exitFullscreen(): Promise<void> {
  if (document.fullscreenElement && document.exitFullscreen) await document.exitFullscreen();
}
