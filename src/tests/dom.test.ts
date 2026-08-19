import { describe, expect, it } from 'vitest';
import { escapeHtml } from '../core/dom';

describe('safe lyric rendering', () => {
  it('escapes markup pasted into lyrics', () => {
    expect(escapeHtml('<img src=x onerror=alert(1)> & “Praise”')).toBe('&lt;img src=x onerror=alert(1)&gt; &amp; “Praise”');
  });
});
