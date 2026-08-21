import { Injectable } from '@angular/core';
import { FieldCategory, FieldType } from '../models/field-definition';
import { BUILT_IN_FIELD_TYPES, FieldTypeMeta } from './field-types';

/**
 * Catalog of field types available to the builder palette and used to
 * resolve metadata everywhere. Hosts can extend it with custom types via
 * `register()` and restrict visibility via allow/deny lists.
 */
@Injectable({ providedIn: 'root' })
export class FieldTypeRegistry {
  private readonly metas = new Map<FieldType, FieldTypeMeta>(
    BUILT_IN_FIELD_TYPES.map((meta) => [meta.type, meta]),
  );
  private allowed: Set<FieldType> | null = null;
  private denied: Set<FieldType> = new Set();

  register(meta: FieldTypeMeta): void {
    this.metas.set(meta.type, meta);
  }

  /** Restrict palette/answering to exactly these types. */
  setAllowed(types: FieldType[] | null): void {
    this.allowed = types ? new Set(types) : null;
  }

  setDenied(types: FieldType[]): void {
    this.denied = new Set(types);
  }

  all(): FieldTypeMeta[] {
    return [...this.metas.values()].filter((meta) => this.isVisible(meta.type));
  }

  byCategory(category: FieldCategory): FieldTypeMeta[] {
    return this.all().filter((meta) => meta.category === category);
  }

  get(type: FieldType): FieldTypeMeta | undefined {
    const meta = this.metas.get(type);
    return meta && this.isVisible(type) ? meta : undefined;
  }

  /** Metadata is always resolvable for any known type so historical
   * definitions keep rendering; visibility only governs what may be
   * newly *created* in the builder palette. */
  isVisible(type: FieldType): boolean {
    if (this.denied.has(type)) return false;
    if (this.allowed && !this.allowed.has(type)) return false;
    return true;
  }
}
