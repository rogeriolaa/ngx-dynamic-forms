/** Sync permission flags the host app computes and passes down. */
export interface FormPermissions {
  canDesign?: boolean;
  canAnswer?: boolean;
  canView?: boolean;
}

/** Async alternative — host resolves permissions however it wants. */
export interface FormPermissionsResolver {
  canDesign?(): boolean | Promise<boolean>;
  canAnswer?(): boolean | Promise<boolean>;
  canView?(): boolean | Promise<boolean>;
}

export type PermissionsInput = FormPermissions | FormPermissionsResolver;

export interface ResolvedPermissions {
  canDesign: boolean;
  canAnswer: boolean;
  canView: boolean;
}

export const FULL_PERMISSIONS: ResolvedPermissions = {
  canDesign: true,
  canAnswer: true,
  canView: true,
};

function isResolver(input: PermissionsInput): input is FormPermissionsResolver {
  const anyInput = input as Record<string, unknown>;
  return (
    typeof anyInput['canDesign'] === 'function' ||
    typeof anyInput['canAnswer'] === 'function' ||
    typeof anyInput['canView'] === 'function'
  );
}

/**
 * Resolves either flavor of permissions input into plain booleans.
 * When nothing is provided the components default to full access — hosts
 * that care about gating must always pass explicit inputs (client checks
 * are UX, real enforcement belongs server-side).
 */
export async function resolvePermissions(
  input?: PermissionsInput | null,
): Promise<ResolvedPermissions> {
  if (!input) {
    return { ...FULL_PERMISSIONS };
  }
  if (!isResolver(input)) {
    return {
      canDesign: input.canDesign ?? false,
      canAnswer: input.canAnswer ?? false,
      canView: input.canView ?? false,
    };
  }
  const resolver = input as FormPermissionsResolver;
  const [canDesign, canAnswer, canView] = await Promise.all([
    resolver.canDesign ? Promise.resolve(resolver.canDesign()) : false,
    resolver.canAnswer ? Promise.resolve(resolver.canAnswer()) : false,
    resolver.canView ? Promise.resolve(resolver.canView()) : false,
  ]);
  return { canDesign: !!canDesign, canAnswer: !!canAnswer, canView: !!canView };
}

/** Convenience for building typed permission objects from a role name (demo helper). */
export function permissionsForRole(
  role: 'designer' | 'respondent' | 'viewer' | 'admin' | 'none',
): FormPermissions {
  switch (role) {
    case 'admin':
      return { canDesign: true, canAnswer: true, canView: true };
    case 'designer':
      return { canDesign: true };
    case 'respondent':
      return { canAnswer: true };
    case 'viewer':
      return { canView: true };
    default:
      return {};
  }
}
