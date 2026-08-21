import { describe, expect, it } from 'vitest';
import { FieldTypeRegistry } from './field-type-registry';
import { BUILT_IN_FIELD_TYPES } from './field-types';

describe('FieldTypeRegistry', () => {
  it('exposes the built-in catalog', () => {
    const registry = new FieldTypeRegistry();
    expect(registry.all().length).toBe(BUILT_IN_FIELD_TYPES.length);
  });

  it('groups by category', () => {
    const registry = new FieldTypeRegistry();
    const inputs = registry.byCategory('input');
    expect(inputs.map((m) => m.type)).toContain('text');
    expect(inputs.map((m) => m.type)).not.toContain('section');

    expect(registry.byCategory('layout').map((m) => m.type)).toEqual(['section']);
    expect(registry.byCategory('hidden').map((m) => m.type)).toEqual(['hidden']);
  });

  it('allow-list hides non-listed types from palette queries', () => {
    const registry = new FieldTypeRegistry();
    registry.setAllowed(['text', 'number']);
    expect(registry.all().map((m) => m.type)).toEqual(['text', 'number']);
  });

  it('deny-list wins over catalog', () => {
    const registry = new FieldTypeRegistry();
    registry.setDenied(['slider']);
    expect(registry.all().map((m) => m.type)).not.toContain('slider');
  });

  it('get() returns undefined for denied types', () => {
    const registry = new FieldTypeRegistry();
    registry.setAllowed(['text']);
    expect(registry.get('rating')).toBeUndefined();
    expect(registry.get('text')).toBeDefined();
  });

  it('supports registering custom types', () => {
    const registry = new FieldTypeRegistry();
    registry.register({
      type: 'cpf' as never,
      label: 'CPF',
      icon: 'pi pi-id-card',
      category: 'input',
      supportsOptions: false,
      defaultConfig: {},
    });
    expect(registry.byCategory('input').some((m) => m.label === 'CPF')).toBe(true);
  });
});
