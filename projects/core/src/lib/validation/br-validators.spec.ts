import { describe, expect, it } from 'vitest';
import { FormControl } from '@angular/forms';
import { makeField, makeForm } from '../../testing/definition-fixtures';
import { buildFormGroup, validatorsFor } from '../runtime/form-group-builder';
import {
  formatCep,
  formatCnpj,
  formatCpf,
  isValidCep,
  isValidCnpj,
  isValidCpf,
} from './br-validators';

const errorOf = (value: unknown, validator: (c: FormControl) => unknown): unknown =>
  validator(new FormControl(value));

describe('formatCpf / formatCnpj / formatCep', () => {
  it('applies display masks progressively', () => {
    expect(formatCpf('12345678901')).toBe('123.456.789-01');
    expect(formatCpf('123456789')).toBe('123.456.789');
    expect(formatCnpj('12345678000195')).toBe('12.345.678/0001-95');
    expect(formatCnpj('123456780001')).toBe('12.345.678/0001');
    expect(formatCep('01310100')).toBe('01310-100');
    expect(formatCep('01310')).toBe('01310');
  });

  it('ignores non-digit junk and caps length', () => {
    expect(formatCpf('123.456.789-01xyz')).toBe('123.456.789-01');
    expect(formatCnpj('a1b2c3d4e5f6g7h8i9j0k')).toBe('12.345.678/90');
  });
});

describe('isValidCpf', () => {
  it('accepts valid documents in any formatting', () => {
    expect(isValidCpf('11144477735')).toBe(true);
    expect(isValidCpf('111.444.777-35')).toBe(true);
  });

  it('rejects wrong check digits and known-invalid patterns', () => {
    expect(isValidCpf('11144477734')).toBe(false);
    expect(isValidCpf('11111111111')).toBe(false);
    expect(isValidCpf('1234567890')).toBe(false); // short
    expect(isValidCpf('')).toBe(false);
  });
});

describe('isValidCnpj', () => {
  it('accepts valid documents in any formatting', () => {
    expect(isValidCnpj('11444777000161')).toBe(true);
    expect(isValidCnpj('11.444.777/0001-61')).toBe(true);
  });

  it('rejects wrong check digits and malformed input', () => {
    expect(isValidCnpj('11444777000162')).toBe(false);
    expect(isValidCnpj('11111111111111')).toBe(false);
    expect(isValidCnpj('114447770001')).toBe(false);
  });
});

describe('isValidCep', () => {
  it('accepts exactly 8 digits with or without dash', () => {
    expect(isValidCep('01310100')).toBe(true);
    expect(isValidCep('01310-100')).toBe(true);
    expect(isValidCep('0131010')).toBe(false);
    expect(isValidCep('013101000')).toBe(false);
  });
});

describe('buildFormGroup wiring', () => {
  const def = makeForm([
    makeField('cpf', 'cpf'),
    makeField('cnpj', 'cnpj'),
    makeField('cep', 'cep'),
  ]);
  const group = buildFormGroup(def).group;

  it('marks empty values valid (required stays separate)', () => {
    expect(group.controls['cpf'].valid).toBe(true);
  });

  it('flags invalid documents under their own error keys', () => {
    group.controls['cpf'].setValue('11144477734');
    expect(group.controls['cpf'].errors?.['cpf']).toBe(true);

    group.controls['cnpj'].setValue('11.444.777/0001-99');
    expect(group.controls['cnpj'].errors?.['cnpj']).toBe(true);

    group.controls['cep'].setValue('123');
    expect(group.controls['cep'].errors?.['cep']).toBe(true);
  });

  it('accepts masked valid values', () => {
    group.controls['cpf'].setValue('111.444.777-35');
    expect(group.controls['cpf'].valid).toBe(true);

    group.controls['cnpj'].setValue('11.444.777/0001-61');
    expect(group.controls['cnpj'].valid).toBe(true);

    group.controls['cep'].setValue('01310-100');
    expect(group.controls['cep'].valid).toBe(true);
  });

  it('registers validators per type through validatorsFor', () => {
    const fns = validatorsFor(makeField('x', 'cpf'));
    expect(fns.length).toBeGreaterThan(0);
  });
});
