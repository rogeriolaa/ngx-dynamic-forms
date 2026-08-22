import { describe, expect, it } from 'vitest';
import {
  buildFormGroup,
  deserializeValues,
  initialValueFor,
  serializeValues,
} from '@n0n3br/ngx-dynamic-forms-core';
import { makeField, makeForm } from '@n0n3br/ngx-dynamic-forms-core';

describe('buildFormGroup', () => {
  it('creates one control per value-holding field', () => {
    const def = makeForm([
      makeField('a'),
      makeField('b', 'number'),
      makeField('s', 'section'),
    ]);
    const { group, staticallyDisabled } = buildFormGroup(def);
    expect(Object.keys(group.controls)).toEqual(['a', 'b']);
    expect(group.getRawValue()).toEqual({ a: null, b: null });
    expect(staticallyDisabled.size).toBe(0);
  });

  it('marks configured-disabled fields as statically disabled', () => {
    const def = makeForm([makeField('locked', 'text', { disabled: true })]);
    const { group, staticallyDisabled } = buildFormGroup(def);
    expect(group.controls['locked'].disabled).toBe(true);
    expect(staticallyDisabled.has('locked')).toBe(true);
  });

  it('applies required / email / maxLength / min / max validators', () => {
    const def = makeForm([
      makeField('mail', 'email', { required: true }),
      makeField('bio', 'textarea', { maxLength: 5 }),
      makeField('age', 'number', { min: 18, max: 99 }),
    ]);
    const { group } = buildFormGroup(def);
    expect(group.controls['mail'].hasError('required')).toBe(true);

    group.controls['mail'].setValue('not-an-email');
    expect(group.controls['mail'].hasError('email')).toBe(true);

    group.controls['bio'].setValue('way too long');
    expect(group.controls['bio'].hasError('maxlength')).toBe(true);

    group.controls['age'].setValue(10);
    expect(group.controls['age'].hasError('min')).toBe(true);
    group.controls['age'].setValue(120);
    expect(group.controls['age'].hasError('max')).toBe(true);
  });

  it('applies pattern validators on text fields', () => {
    const def = makeForm([
      makeField('code', 'text', { pattern: '^[A-Z]{2}$' }),
    ]);
    const { group } = buildFormGroup(def);
    group.controls['code'].setValue('abc');
    expect(group.controls['code'].hasError('pattern')).toBe(true);
    group.controls['code'].setValue('AB');
    expect(group.controls['code'].valid).toBe(true);
  });

  it('seeds typed zero values when no default is configured', () => {
    const def = makeForm([
      makeField('cb', 'checkbox'),
      makeField('m', 'multi-select'),
    ]);
    const { group } = buildFormGroup(def);
    expect(group.controls['cb'].value).toBe(false);
    expect(group.controls['m'].value).toEqual([]);
  });

  it('uses configured defaultValue when present', () => {
    const def = makeForm([
      makeField('hidden-src', 'hidden', { defaultValue: 'campaign-x' }),
    ]);
    const { group } = buildFormGroup(def);
    expect(group.controls['hidden-src'].value).toBe('campaign-x');
  });
});

describe('serializeValues / deserializeValues', () => {
  it('converts Date values to ISO strings and back', () => {
    const def = makeForm([makeField('when', 'date')]);
    const iso = serializeValues(def, { when: new Date('2026-03-01T12:00:00Z') });
    expect(iso['when']).toBe('2026-03-01T12:00:00.000Z');

    const back = deserializeValues(def, iso);
    expect(back['when']).toBeInstanceOf(Date);
  });

  it('omits empty values so "no answer" never looks like data', () => {
    const def = makeForm([
      makeField('t', 'text'),
      makeField('m', 'multi-select'),
      makeField('cb', 'checkbox'),
    ]);
    const out = serializeValues(def, { t: '', m: [], cb: false });
    // false is meaningful for checkbox; null/''/[] are not answers
    expect(out).toEqual({ cb: false });
  });

  it('skips section fields entirely', () => {
    const def = makeForm([makeField('s', 'section'), makeField('a')]);
    const out = serializeValues(def, { s: 'ignored', a: 'kept' });
    expect(out).toEqual({ a: 'kept' });
  });
});

describe('initialValueFor', () => {
  it('falls back to per-type zero values', () => {
    expect(initialValueFor(makeField('c', 'checkbox'))).toBe(false);
    expect(initialValueFor(makeField('m', 'checkbox-group'))).toEqual([]);
    expect(initialValueFor(makeField('t', 'text'))).toBeNull();
  });
});
