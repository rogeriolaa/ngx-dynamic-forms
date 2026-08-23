import { describe, expect, it } from 'vitest';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { makeField } from '../../testing/definition-fixtures';
import {
  fieldsOfStep,
  invalidStepFieldIds,
  isStepFieldsValid,
  resolveFieldStepId,
} from './wizard';

const steps = [
  { id: 's1', title: 'One' },
  { id: 's2', title: 'Two' },
];

describe('resolveFieldStepId', () => {
  it('returns null on single-page forms', () => {
    expect(resolveFieldStepId(makeField('a'), undefined)).toBeNull();
    expect(resolveFieldStepId(makeField('a'), [])).toBeNull();
  });

  it('honors explicit steps and falls back to the first one', () => {
    expect(resolveFieldStepId(makeField('a', 'text', { stepId: 's2' }), steps)).toBe('s2');
    expect(resolveFieldStepId(makeField('a'), steps)).toBe('s1');
    // unknown step id → first step
    expect(resolveFieldStepId(makeField('a', 'text', { stepId: 'ghost' }), steps)).toBe('s1');
  });
});

describe('fieldsOfStep', () => {
  it('filters by resolved step preserving order', () => {
    const fields = [makeField('a', 'text', { stepId: 's1' }), makeField('b'), makeField('c', 'text', { stepId: 's2' })];
    expect(fieldsOfStep(fields, steps, 's1').map((f) => f.id)).toEqual(['a', 'b']);
    expect(fieldsOfStep(fields, steps, 's2').map((f) => f.id)).toEqual(['c']);
  });
});

describe('step validation helpers', () => {
  const fields = [
    makeField('req1', 'text', { required: true, stepId: 's1' }),
    makeField('opt1'),
    makeField('req2', 'text', { required: true, stepId: 's2' }),
  ];
  const group = () =>
    new FormGroup({
      req1: new FormControl('', Validators.required),
      opt1: new FormControl(''),
      req2: new FormControl('hidden-never-blocks-step1', Validators.required),
    });

  it('only counts controls of the requested step', () => {
    expect(isStepFieldsValid(fields, steps, 's1', group())).toBe(false);
    expect(isStepFieldsValid(fields, steps, 's2', group())).toBe(true);
  });

  it('passes once the step is filled and ignores disabled controls', () => {
    const g = group();
    g.controls['req1'].setValue('filled');
    expect(isStepFieldsValid(fields, steps, 's1', g)).toBe(true);

    g.controls['req1'].disable();
    g.controls['req1'].setValue('');
    expect(isStepFieldsValid(fields, steps, 's1', g)).toBe(true); // disabled never blocks
  });

  it('returns false without a group', () => {
    expect(isStepFieldsValid(fields, steps, 's1', null)).toBe(false);
  });

  it('lists invalid ids scoped to the step', () => {
    expect(invalidStepFieldIds(fields, steps, 's1', group())).toEqual(['req1']);
    expect(invalidStepFieldIds(fields, steps, 's2', group())).toEqual([]);
  });
});
