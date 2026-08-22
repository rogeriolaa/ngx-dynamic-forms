import { describe, expect, it } from 'vitest';
import { FormBuilderStore } from './form-builder-store';
import { RuleEditor } from './rule-editor';
import { makeField, makeForm } from '../../../core/src/testing/definition-fixtures';
import type { Dependency } from '@n0n3br/ngx-form-dependency-engine';

describe('FormBuilderStore', () => {
  it('adds fields and selects the new one', () => {
    const store = new FormBuilderStore();
    store.load(makeForm([]));
    store.addField('text', { defaultConfig: {} });
    expect(store.definition()?.fields).toHaveLength(1);
    expect(store.selectedFieldId()).toBe(store.definition()!.fields[0].id);
  });

  it('removing a field also drops rules that reference it', () => {
    const store = new FormBuilderStore();
    const def = makeForm(
      [makeField('a', 'text'), makeField('b', 'text')],
      [
        {
          id: 'r1',
          target: 'b',
          when: {
            logic: 'AND',
            conditions: [{ field: 'a', operator: 'equals', value: 'x' }],
          },
          effects: [{ type: 'show' }],
        } as unknown as Dependency,
      ],
    );
    store.load(def);
    store.removeField('a');
    expect(store.definition()?.dependencies).toHaveLength(0);
  });

  it('moves and duplicates fields', () => {
    const store = new FormBuilderStore();
    store.load(makeForm([makeField('a'), makeField('b')]));
    store.move('b', -1);
    expect(store.definition()!.fields.map((f) => f.id)).toEqual(['b', 'a']);

    store.duplicateField('b');
    const ids = store.definition()!.fields.map((f) => f.id);
    expect(ids).toHaveLength(3);
    expect(new Set(ids).size).toBe(3);
  });

  it('surfaces validation issues from the definition', () => {
    const store = new FormBuilderStore();
    store.load(makeForm([makeField('dup'), makeField('dup')]));
    expect(store.blockingErrorCount()).toBeGreaterThan(0);
  });
});

describe('RuleEditor serialization', () => {
  let editor: RuleEditor;

  beforeEach(() => {
    // instantiate without Angular — only static (de)serialization is tested
    editor = Object.create(RuleEditor.prototype) as RuleEditor;
    Object.assign(editor, {
      definition: () =>
        makeForm([
          makeField('satisfied', 'radio'),
          makeField('reason', 'dropdown'),
        ]),
    });
  });

  it('serializes a "show when" rule with mirrored hide on the else branch', () => {
    const dep = (editor as any).serialize({
      id: 'r1',
      action: 'show',
      target: 'reason',
      requireIt: true,
      logic: 'AND',
      conditions: [{ field: 'satisfied', operator: 'equals', value: 'no' }],
    }) as Dependency;

    expect(dep.target).toBe('reason');
    expect(dep.when.logic).toBe('AND');
    expect(dep.effects).toEqual([
      { type: 'show' },
      { type: 'setRequired' },
    ]);
    expect(dep.elseEffects).toEqual([
      { type: 'hide' },
      { type: 'unsetRequired' },
    ]);
  });

  it('round-trips show/hide actions through deserialize', () => {
    const dep = {
      id: 'r2',
      target: 'reason',
      when: { logic: 'OR', conditions: [{ field: 'satisfied', operator: 'equals', value: 'no' }] },
      effects: [{ type: 'hide' }],
      elseEffects: [{ type: 'show' }],
    } as unknown as Dependency;

    const ui = (editor as any).deserialize(dep);
    expect(ui.action).toBe('hide');
    expect(ui.logic).toBe('OR');
    expect(ui.requireIt).toBe(false);

    const back = (editor as any).serialize(ui) as Dependency;
    expect(back.effects[0]).toEqual({ type: 'hide' });
    expect(back.elseEffects?.[0]).toEqual({ type: 'show' });
  });
});
