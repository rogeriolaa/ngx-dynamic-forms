import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

/**
 * Brazilian document/ZIP validators + display masks. Pure functions —
 * safe for unit tests and reuse outside Angular forms.
 */

const digitsOnly = (value: unknown): string =>
  typeof value === 'string' ? value.replace(/\D/g, '') : '';

const allSameDigit = (digits: string): boolean => /^(\d)\1+$/.test(digits);

/** 000.000.000-00 */
export function formatCpf(value: string): string {
  const d = digitsOnly(value).slice(0, 11);
  return d
    .replace(/^(\d{3})(\d)/, '$1.$2')
    .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d{1,2})$/, '.$1-$2');
}

/** 00.000.000/0000-00 */
export function formatCnpj(value: string): string {
  const d = digitsOnly(value).slice(0, 14);
  return d
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d{1,2})$/, '$1-$2');
}

/** 00000-000 */
export function formatCep(value: string): string {
  return digitsOnly(value).slice(0, 8).replace(/^(\d{5})(\d)/, '$1-$2');
}

/** CPF check-digit algorithm (mod-11, cumulative weights). */
export function isValidCpf(raw: unknown): boolean {
  const cpf = digitsOnly(raw);
  if (cpf.length !== 11 || allSameDigit(cpf)) return false;

  const check = (length: number, weightStart: number): number => {
    let sum = 0;
    for (let i = 0; i < length; i++) {
      sum += Number(cpf[i]) * (weightStart - i);
    }
    const rest = (sum * 10) % 11;
    return rest === 10 ? 0 : rest;
  };

  return check(9, 10) === Number(cpf[9]) && check(10, 11) === Number(cpf[10]);
}

/** CNPJ check-digit algorithm (two rounds of weighted mod-11). */
export function isValidCnpj(raw: unknown): boolean {
  const cnpj = digitsOnly(raw);
  if (cnpj.length !== 14 || allSameDigit(cnpj)) return false;

  const calc = (slice: number): number => {
    const weights = slice === 12
      ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
      : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    let sum = 0;
    for (let i = 0; i < weights.length; i++) {
      sum += Number(cnpj[i]) * weights[i];
    }
    const rest = sum % 11;
    return rest < 2 ? 0 : 11 - rest;
  };

  return calc(12) === Number(cnpj[12]) && calc(13) === Number(cnpj[13]);
}

/** Exactly 8 digits (accepts the 00000-000 display form). */
export function isValidCep(raw: unknown): boolean {
  return /^\d{8}$/.test(digitsOnly(raw));
}

/**
 * Validator factory — empty values pass through so `required` stays the
 * single source of "must be filled".
 */
export function validateCpf(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null =>
    !control.value || isValidCpf(control.value) ? null : { cpf: true };
}

export function validateCnpj(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null =>
    !control.value || isValidCnpj(control.value) ? null : { cnpj: true };
}

export function validateCep(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null =>
    !control.value || isValidCep(control.value) ? null : { cep: true };
}
