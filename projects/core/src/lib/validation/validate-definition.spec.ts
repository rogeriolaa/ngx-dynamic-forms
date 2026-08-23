import { describe, expect, it } from 'vitest';
import {
  collectConditionFields,
  topologicalSort,
  validateDefinition,
} from './validate-definition';
import { makeField, makeForm, showWhen } from '../../testing/definition-fixtures';

const errorMessages = (issues: ReturnType<typeof validateDefinition>) =>
  issues.filter((i) => i.severity === 'error').map((i) => i.message);

describe('validateDefinition', () => {
  it('accepts a clean form with no issues', () => {
    const def = makeForm([makeField('a'), makeField('b')]);
    expect(validateDefinition(def)).toEqual([]);
  });

  it('rejects missing title', () => {
    const def = makeForm([makeField('a')], [], { title: '' });
    expect(errorMessages(validateDefinition(def))).toContainEqual(
      expect.stringContaining('title'),
    );
  });

  it('rejects duplicate field ids', () => {
    const def = makeForm([makeField('a'), makeField('a')]);
    const errors = errorMessages(validateDefinition(def));
    expect(errors.some((m) => m.includes('Duplicate'))).toBe(true);
  });

  it('requires options for option-driven types', () => {
    const def = makeForm([
      { id: 'd', type: 'dropdown', label: 'Pick' },
      { id: 'r', type: 'radio', label: 'Choose' },
    ]);
    const errors = errorMessages(validateDefinition(def));
    expect(errors).toHaveLength(2);
    expect(errors[0]).toContain('option');
  });

  it('flags rules targeting missing fields', () => {
    const def = makeForm([makeField('a')], [showWhen('a', 'x', 'ghost')]);
    expect(errorMessages(validateDefinition(def)).some((m) => m.includes('ghost'))).toBe(true);
  });

  it('flags rules reading from missing fields', () => {
    const def = makeForm([makeField('b')], [showWhen('ghost', 'x', 'b')]);
    expect(errorMessages(validateDefinition(def)).some((m) => m.includes('ghost'))).toBe(true);
  });

  it('rejects targeting valueless fields (section)', () => {
    const def = makeForm(
      [makeField('s', 'section'), makeField('a')],
      [showWhen('a', 'x', 's')],
    );
    expect(errorMessages(validateDefinition(def)).some((m) => m.includes('cannot hold'))).toBe(
      true,
    );
  });

  it('rejects self-referencing rules', () => {
    const def = makeForm([makeField('a')], [showWhen('a', 'x', 'a')]);
    expect(errorMessages(validateDefinition(def)).some((m) => m.includes('circular'))).toBe(
      true,
    );
  });

  it('detects two-field circular dependency', () => {
    const fields = [makeField('a', 'text'), makeField('b', 'text')];
    const def = makeForm(fields, [
      showWhen('a', 'x', 'b', 'r1'),
      showWhen('b', 'y', 'a', 'r2'),
    ]);
    const errors = errorMessages(validateDefinition(def));
    expect(errors.some((m) => m.startsWith('Circular dependency detected'))).toBe(true);
  });

  it('detects three-hop cycle', () => {
    const fields = [
      makeField('a', 'text'),
      makeField('b', 'text'),
      makeField('c', 'text'),
    ];
    const def = makeForm(fields, [
      showWhen('a', '1', 'b', 'r1'),
      showWhen('b', '2', 'c', 'r2'),
      showWhen('c', '3', 'a', 'r3'),
    ]);
    expect(
      errorMessages(validateDefinition(def)).some((m) => m.startsWith('Circular')),
    ).toBe(true);
  });

  it('does not flag linear chains', () => {
    const fields = [
      makeField('a', 'text'),
      makeField('b', 'text'),
      makeField('c', 'text'),
    ];
    const def = makeForm(fields, [
      showWhen('a', '1', 'b', 'r1'),
      showWhen('b', '2', 'c', 'r2'),
    ]);
    expect(errorMessages(validateDefinition(def))).toEqual([]);
  });

  it('warns when a large form has no conditional rules', () => {
    const def = makeForm([makeField('a'), makeField('b'), makeField('c'), makeField('d')]);
    const warnings = validateDefinition(def).filter((i) => i.severity === 'warning');
    expect(warnings.length).toBe(1);
  });
});

describe('validateDefinition — wizard steps', () => {
  it('accepts a clean multi-step form (fields may omit step → first)', () => {
    const def = makeForm(
      [makeField('a'), makeField('b', 'text', { stepId: 's2' })],
      [],
      { steps: [{ id: 's1', title: 'One' }, { id: 's2', title: 'Two' }] },
    );
    expect(validateDefinition(def)).toEqual([]);
  });

  it('rejects duplicate step ids', () => {
    const def = makeForm([makeField('a')], [], {
      steps: [
        { id: 's1', title: 'One' },
        { id: 's1', title: 'Two' },
      ],
    });
    expect(errorMessages(validateDefinition(def)).some((m) => m.includes('Duplicate step'))).toBe(
      true,
    );
  });

  it('rejects fields referencing missing steps', () => {
    const def = makeForm([makeField('a', 'text', { stepId: 'ghost' })], [], {
      steps: [{ id: 's1', title: 'One' }],
    });
    expect(errorMessages(validateDefinition(def)).some((m) => m.includes('ghost'))).toBe(true);
  });

  it('warns when steps exist without titles', () => {
    const def = makeForm([makeField('a')], [], { steps: [{ id: 's1', title: '' }] });
    const warnings = validateDefinition(def).filter((i) => i.severity === 'warning');
    expect(warnings.some((w) => w.message.includes('no title'))).toBe(true);
  });

  it('warns when fields reference steps but the form defines none', () => {
    const def = makeForm([makeField('a', 'text', { stepId: 's9' })]);
    const warnings = validateDefinition(def).filter((i) => i.severity === 'warning');
    expect(warnings.some((w) => w.message.includes('no steps'))).toBe(true);
  });
});

describe('topologicalSort / collectConditionFields', () => {
  it('collects fields from nested condition groups', () => {
    const dep = showWhen('outer', '1', 't');
    dep.when.conditions.push({
      logic: 'OR',
      conditions: [{ field: 'nested', operator: 'equals', value: '2' }],
    } as never);
    expect(collectConditionFields(dep.when)).toEqual(['outer', 'nested']);
  });

  it('returns cycle participants on cyclic graph', () => {
    const result = topologicalSort(['a', 'b'], [showWhen('a', 'x', 'b'), showWhen('b', 'y', 'a')]);
    expect(result.cycle).not.toBeNull();
    expect(result.cycle).toHaveLength(2);
  });
});
