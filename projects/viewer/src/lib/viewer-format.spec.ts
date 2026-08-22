import { describe, expect, it } from 'vitest';
import { formatValue, labelFor } from './form-viewer';
import { makeField } from '../../../core/src/testing/definition-fixtures';

describe('viewer value formatting', () => {
  it('renders checkbox as Yes/No', () => {
    const f = makeField('cb', 'checkbox');
    expect(formatValue(f, true)).toBe('Yes');
    expect(formatValue(f, false)).toBe('No');
  });

  it('maps option values to labels for choice fields', () => {
    const f = makeField('d', 'dropdown');
    expect(formatValue(f, 'a')).toBe('A');
    expect(labelFor(f, 'zzz')).toBe('zzz');
  });

  it('joins multi-select answers with labels', () => {
    const f = makeField('m', 'multi-select');
    expect(formatValue(f, ['a', 'c'])).toBe('A, C');
    expect(formatValue(f, [])).toBe('—');
  });

  it('renders ratings as stars within max bounds', () => {
    const f = makeField('r', 'rating', { max: 5 });
    expect(formatValue(f, 3)).toBe('★★★☆☆');
    expect(formatValue(f, 99)).toBe('★★★★★');
  });

  it('formats dates and falls back to em-dash for empties', () => {
    const d = makeField('d', 'date');
    expect(formatValue(d, '2026-03-01')).toContain('2026');
    expect(formatValue(makeField('t'), '')).toBe('—');
    expect(formatValue(makeField('t'), null)).toBe('—');
  });
});
