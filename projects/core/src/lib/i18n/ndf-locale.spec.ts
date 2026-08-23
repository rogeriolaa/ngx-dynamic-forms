import { describe, expect, it } from 'vitest';
import { interpolate, NDF_LOCALE_EN, NDF_LOCALES, NDF_LOCALE_PT_BR } from './ndf-locale';

describe('NdfLocale dictionaries', () => {
  it('pt-BR covers every key of the en dictionary', () => {
    const enKeys = Object.keys(NDF_LOCALE_EN).sort();
    const ptKeys = Object.keys(NDF_LOCALE_PT_BR).sort();
    expect(ptKeys).toEqual(enKeys);
  });

  it('exposes both built-ins under their codes', () => {
    expect(NDF_LOCALES['en']).toBe(NDF_LOCALE_EN);
    expect(NDF_LOCALES['pt-BR']).toBe(NDF_LOCALE_PT_BR);
  });

  it('every value is a non-empty string', () => {
    for (const dict of [NDF_LOCALE_EN, NDF_LOCALE_PT_BR]) {
      for (const [key, value] of Object.entries(dict)) {
        expect(typeof value).toBe('string');
        expect((value as string).length).toBeGreaterThan(0);
      }
    }
  });
});

describe('interpolate', () => {
  it('replaces named tokens', () => {
    expect(interpolate('v{version} done', { version: 3 })).toBe('v3 done');
  });

  it('leaves unknown tokens untouched and handles multiples', () => {
    expect(interpolate('{a} then {b} then {missing}', { a: 1, b: 'x' })).toBe(
      '1 then x then {missing}',
    );
  });
});
