import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { NgxFormsService, provideNgxForms } from './index';
import { makeField, makeForm, showWhen } from '../../testing/definition-fixtures';

function uniqueDb(): string {
  return `svc-${Math.random().toString(36).slice(2)}`;
}

describe('NgxFormsService', () => {
  let service: NgxFormsService;
  let dbName: string;

  beforeEach(async () => {
    dbName = uniqueDb();
    await TestBed.configureTestingModule({
      providers: [provideNgxForms({ databaseName: dbName })],
    }).compileComponents();
    service = TestBed.inject(NgxFormsService);
  });

  afterEach(async () => {
    const { IndexedDbFormsStore } = await import('./indexeddb-repository');
    const store = new IndexedDbFormsStore(dbName);
    await store.wipe();
    TestBed.resetTestingModule();
  });

  it('creates a draft form', async () => {
    const created = await service.createForm('My form', 'tester');
    expect(created.status).toBe('draft');
    expect(created.version).toBe(1);
    const listed = await service.listForms();
    expect(listed).toHaveLength(1);
  });

  it('blocks saving invalid definitions with an aggregate error', async () => {
    const bad = makeForm([makeField('a'), makeField('a')]);
    await expect(service.saveWorkingCopy(bad)).rejects.toThrow(/Duplicate field id/);
  });

  it('saves a valid working copy', async () => {
    const clean = makeForm([makeField('a'), makeField('b')]);
    clean.dependencies = [
      {
        id: 'rule',
        target: 'b',
        when: {
          logic: 'AND',
          conditions: [{ field: 'a', operator: 'equals', value: 'x' }],
        },
        effects: [{ type: 'show' }],
      } as never,
    ];
    await service.saveWorkingCopy(clean);
    const reloaded = await service.getDefinition(clean.id);
    expect(reloaded?.dependencies).toHaveLength(1);
  });

  it('publish reports impact and pinned responses on later publishes', async () => {
    await service.saveWorkingCopy(makeForm([makeField('a')]));
    let working = await service.getOrCreateWorkingCopy((await service.listForms())[0].id);

    const first = await service.publish(working.id, working.version);
    expect(first.impact).toBe('none'); // first publish has no predecessor
    expect(first.responsesPerVersion[working.version]).toBeUndefined();

    // answer against v1
    await service.submitResponse({
      definition: first.published,
      values: { a: 'answer' },
      respondentContext: 'u1',
    });

    // edit → v2 → publish
    working = await service.getOrCreateWorkingCopy(working.id);
    working.title = 'Edited';
    await service.saveWorkingCopy(working);
    const second = await service.publish(working.id, working.version);
    expect(second.impact).toBe('cosmetic');
    expect(second.responsesPerVersion[1]).toBe(1);
  });

  it('submit stores response and clears the draft', async () => {
    const def = makeForm([makeField('a')]);
    await service.saveWorkingCopy(def);
    await service.publish(def.id, def.version);
    const published = await service.getLatestPublished(def.id);

    await service.saveDraft({
      definition: published!,
      values: { a: 'partial' },
      respondentContext: 'u1',
    });
    expect(await service.getDraft(published!.id, 'u1')).not.toBeNull();

    const result = await service.submitResponse({
      definition: published!,
      values: { a: 'final' },
      respondentContext: 'u1',
    });
    expect(result.discardedDraft).toBe(true);
    expect(await service.getDraft(published!.id, 'u1')).toBeNull();

    const responses = await service.listResponses(published!.id);
    expect(responses).toHaveLength(1);
    expect(responses[0].formVersion).toBe(1);
  });

  it('duplicates a form into a fresh id and version 1', async () => {
    const original = makeForm([makeField('a')]);
    await service.saveWorkingCopy(original);
    const copy = await service.duplicateForm(original.id);
    expect(copy.id).not.toBe(original.id);
    expect(copy.version).toBe(1);
    expect(copy.title).toContain('(copy)');
    expect(copy.fields).toHaveLength(1);
  });
});
