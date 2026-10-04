import { afterEach, describe, expect, it, vi } from 'vitest';
import { escapeHtml, fitText } from '../core/dom';

afterEach(() => vi.restoreAllMocks());

describe('safe lyric rendering', () => {
  it('escapes markup pasted into lyrics', () => {
    expect(escapeHtml('<img src=x onerror=alert(1)> & “Praise”')).toBe('&lt;img src=x onerror=alert(1)&gt; &amp; “Praise”');
  });
});

describe('strict two-line font fitting', () => {
  it('chooses one shared font size that keeps both source lines on one row', () => {
    const element = document.createElement('div');
    element.style.padding = '0';
    element.style.fontFamily = 'sans-serif';
    element.style.fontSize = '100px';
    element.style.lineHeight = '1';
    element.innerHTML = '<span>Long worship lyric</span><span>Short line</span>';
    Object.defineProperty(element, 'clientWidth', { configurable: true, value: 500 });
    Object.defineProperty(element, 'clientHeight', { configurable: true, value: 240 });
    document.body.append(element);
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      font: '',
      measureText: (text: string) => ({ width: text.length * 50 }),
    } as unknown as CanvasRenderingContext2D);

    fitText(element, 100, 10);

    expect(element.style.fontSize).toBe('55px');
    expect(element.children).toHaveLength(2);
  });

  it('corrects for browser text shaping when a rendered row still overflows', () => {
    const element = document.createElement('div');
    element.style.padding = '0';
    element.style.fontFamily = 'sans-serif';
    element.style.fontSize = '100px';
    element.style.lineHeight = '1';
    element.innerHTML = '<span>Long worship lyric</span><span>Short line</span>';
    Object.defineProperty(element, 'clientWidth', { configurable: true, value: 500 });
    Object.defineProperty(element, 'clientHeight', { configurable: true, value: 240 });
    const firstRow = element.children[0] as HTMLElement;
    Object.defineProperty(firstRow, 'clientWidth', { configurable: true, value: 400 });
    Object.defineProperty(firstRow, 'scrollWidth', { configurable: true, value: 800 });
    document.body.append(element);
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      font: '',
      measureText: () => ({ width: 100 }),
    } as unknown as CanvasRenderingContext2D);

    fitText(element, 100, 10);

    expect(element.style.fontSize).toBe('50px');
  });

  it('uses unitless line-height as a multiplier when fitting a short lyric band', () => {
    const element = document.createElement('div');
    element.style.padding = '0';
    element.style.fontFamily = 'sans-serif';
    element.style.fontSize = '100px';
    element.style.lineHeight = '1.08';
    element.innerHTML = '<span>First line</span><span>Second line</span>';
    Object.defineProperty(element, 'clientWidth', { configurable: true, value: 1000 });
    Object.defineProperty(element, 'clientHeight', { configurable: true, value: 80 });
    document.body.append(element);
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      font: '',
      measureText: (text: string) => ({ width: text.length * 2 }),
    } as unknown as CanvasRenderingContext2D);

    fitText(element, 100, 8);

    expect(element.style.fontSize).toBe('37px');
  });
});
