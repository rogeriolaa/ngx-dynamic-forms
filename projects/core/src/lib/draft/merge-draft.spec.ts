import { describe, expect, it } from 'vitest';
import { mergeDraftValues } from './merge-draft';
import { makeField, makeForm } from '../../testing/definition-fixtures';

describe('mergeDraftValues', () => {
  it('restores values for surviving fields', () => {
    const def = makeForm([makeField('a'), makeField('b', 'number')]);
    const { values, report } = mergeDraftValues({ a: 'kept', b: 42 }, def);
    expect(values).toEqual({ a: 'kept', b: 42 });
    expect(report.restored).toEqual(['a', 'b']);
    expect(report.dropped).toEqual([]);
  });

  it('applies defaults to new fields and reports them', () => {
    const def = makeForm([
      makeField('new', 'text', { defaultValue: 'auto' }),
      makeField('num', 'slider', { min: 0, max: 10 }),
    ]);
    const { values, report } = mergeDraftValues({}, def);
    expect(values['new']).toBe('auto');
    expect(values['num']).toBeNull();
    expect(report.defaulted).toEqual(['new']);
  });

  it('drops values for removed fields with report entry', () => {
    const def = makeForm([makeField('a')]);
    const { values, report } = mergeDraftValues(
      { a: 'kept', removed: 'gone' },
      def,
    );
    expect(values['removed']).toBeUndefined();
    expect(report.dropped).toEqual([{ fieldId: 'removed', value: 'gone' }]);
  });

  it('drops type-incompatible values (text → number)', () => {
    const def = makeForm([makeField('n', 'number')]);
    const { values, report } = mergeDraftValues({ n: 'not-a-number' }, def);
    expect(values['n']).toBeNull();
    expect(report.dropped.map((d) => d.fieldId)).toEqual(['n']);
  });

  it('keeps arrays for multi-value types', () => {
    const def = makeForm([makeField('m', 'multi-select')]);
    const { values } = mergeDraftValues({ m: ['a', 'c'] }, def);
    expect(values['m']).toEqual(['a', 'c']);
  });

  it('coerces booleans strictly for checkbox', () => {
    const def = makeForm([makeField('cb', 'checkbox')]);
    const ok = mergeDraftValues({ cb: true }, def);
    const bad = mergeDraftValues({ cb: 'yes' }, def);
    expect(ok.values['cb']).toBe(true);
    expect(bad.report.dropped.length).toBe(1);
  });

  it('handles null/undefined input gracefully', () => {
    const def = makeForm([makeField('a')]);
    const empty = mergeDraftValues(null, def);
    expect(empty.report.dropped).toEqual([]);
  });

  it('skips section fields entirely', () => {
    const def = makeForm([makeField('s', 'section'), makeField('a')]);
    const { values, report } = mergeDraftValues({ a: 'x' }, def);
    expect(values['s']).toBeUndefined();
    expect(report.restored).toEqual(['a']);
  });
});
