import { describe, expect, it } from 'vitest';
import { classifyChange, semanticFingerprint } from './fingerprint';
import { makeField, makeForm, showWhen } from '../../testing/definition-fixtures';

describe('semanticFingerprint', () => {
  it('is stable across identical definitions', () => {
    const a = makeForm([makeField('a'), makeField('b')]);
    const b = makeForm([makeField('a'), makeField('b')]);
    expect(semanticFingerprint(a)).toBe(semanticFingerprint(b));
  });

  it('ignores field order (cosmetic)', () => {
    const a = makeForm([makeField('a'), makeField('b')]);
    const b = makeForm([makeField('b'), makeField('a')]);
    expect(semanticFingerprint(a)).toBe(semanticFingerprint(b));
  });

  it('ignores labels, placeholders and help text', () => {
    const base = makeForm([makeField('a')]);
    const relabeled = makeForm([
      makeField('a', 'text', { label: 'New label', placeholder: 'p', helpText: 'h' }),
    ]);
    expect(semanticFingerprint(base)).toBe(semanticFingerprint(relabeled));
  });

  it('changes when required flag changes (structural)', () => {
    const base = makeForm([makeField('a')]);
    const stricter = makeForm([makeField('a', 'text', { required: true })]);
    expect(semanticFingerprint(base)).not.toBe(semanticFingerprint(stricter));
  });

  it('changes when options change', () => {
    const base = makeForm([makeField('d', 'dropdown')]);
    const more = makeForm([
      makeField('d', 'dropdown', { options: [{ label: 'A', value: 'a' }] }),
    ]);
    expect(semanticFingerprint(base)).not.toBe(semanticFingerprint(more));
  });

  it('changes when dependencies change', () => {
    const fields = [makeField('a'), makeField('b')];
    const withoutRule = makeForm(fields);
    const withRule = makeForm(fields, [showWhen('a', 'x', 'b')]);
    expect(semanticFingerprint(withoutRule)).not.toBe(semanticFingerprint(withRule));
  });
});

describe('classifyChange', () => {
  it('returns structural when fingerprints differ', () => {
    const base = makeForm([makeField('a')]);
    const next = makeForm([makeField('a', 'text', { required: true })]);
    expect(classifyChange(base, next)).toBe('structural');
  });

  it('returns cosmetic when only presentation changed', () => {
    const base = makeForm([makeField('a')], [], { title: 'Old title' });
    const next = makeForm([makeField('a', 'text', { label: 'Renamed' })], [], {
      title: 'New title',
    });
    // stableStringify differs only in cosmetic keys → cosmetic
    expect(classifyChange(base, next)).toBe('cosmetic');
  });

  it('returns none for fully identical content', () => {
    const def = makeForm([makeField('a')]);
    expect(classifyChange(def, structuredClone(def))).toBe('none');
  });
});
