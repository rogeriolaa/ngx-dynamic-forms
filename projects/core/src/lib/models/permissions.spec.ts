import { describe, expect, it } from 'vitest';
import {
  FULL_PERMISSIONS,
  permissionsForRole,
  resolvePermissions,
} from './permissions';

describe('resolvePermissions', () => {
  it('defaults to full access when nothing is provided', async () => {
    expect(await resolvePermissions()).toEqual(FULL_PERMISSIONS);
    expect(await resolvePermissions(null)).toEqual(FULL_PERMISSIONS);
  });

  it('resolves a plain object, defaulting missing flags to false', async () => {
    const result = await resolvePermissions({ canAnswer: true });
    expect(result).toEqual({ canDesign: false, canAnswer: true, canView: false });
  });

  it('awaits async resolvers in parallel', async () => {
    const result = await resolvePermissions({
      canDesign: async () => true,
      canAnswer: () => Promise.resolve(false),
      canView: () => false,
    });
    expect(result).toEqual({ canDesign: true, canAnswer: false, canView: false });
  });

  it('treats undefined resolver methods as denied', async () => {
    const result = await resolvePermissions({});
    expect(result).toEqual({ canDesign: false, canAnswer: false, canView: false });
  });
});

describe('permissionsForRole', () => {
  it.each([
    ['admin', { canDesign: true, canAnswer: true, canView: true }],
    ['designer', { canDesign: true }],
    ['respondent', { canAnswer: true }],
    ['viewer', { canView: true }],
    ['none', {}],
  ] as const)('maps %s', (role, expected) => {
    expect(permissionsForRole(role)).toEqual(expected);
  });
});
