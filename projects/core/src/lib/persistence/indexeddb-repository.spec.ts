import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  createIndexedDbDefinitionRepository,
  createIndexedDbResponseRepository,
  IndexedDbFormsStore,
} from './indexeddb-repository';
import { makeField, makeForm, showWhen } from '../../testing/definition-fixtures';

function uniqueDb(): string {
  return `test-${Math.random().toString(36).slice(2)}`;
}

describe('IndexedDB repositories (versioning invariants)', () => {
  let store: IndexedDbFormsStore;
  let definitions: ReturnType<typeof createIndexedDbDefinitionRepository>;
  let responses: ReturnType<typeof createIndexedDbResponseRepository>;

  beforeEach(() => {
    store = new IndexedDbFormsStore(uniqueDb());
    definitions = createIndexedDbDefinitionRepository(store);
    responses = createIndexedDbResponseRepository(store);
  });

  afterEach(async () => {
    await store.wipe();
  });

  it('saves a working copy as a draft', async () => {
    const saved = await definitions.saveWorkingCopy(makeForm([makeField('a')]));
    expect(saved.status).toBe('draft');
    const loaded = await definitions.getById(saved.id);
    expect(loaded?.fields).toHaveLength(1);
  });

  it('getOrCreateWorkingCopy bumps the version after publish', async () => {
    const draft = await definitions.saveWorkingCopy(makeForm([makeField('a')]));
    const published = await definitions.publish(draft.id, draft.version);
    expect(published.status).toBe('published');

    const working = await definitions.getOrCreateWorkingCopy(draft.id);
    expect(working.status).toBe('draft');
    expect(working.version).toBe(published.version + 1);
    // published version untouched
    const stillThere = await definitions.getById(draft.id, draft.version);
    expect(stillThere?.status).toBe('published');
  });

  it('returns the same draft on repeated getOrCreateWorkingCopy calls', async () => {
    const draft = await definitions.saveWorkingCopy(makeForm([makeField('a')]));
    const again = await definitions.getOrCreateWorkingCopy(draft.id);
    expect(again.version).toBe(draft.version);
  });

  it('publish is idempotent', async () => {
    const draft = await definitions.saveWorkingCopy(makeForm([makeField('a')]));
    const first = await definitions.publish(draft.id, draft.version);
    const second = await definitions.publish(draft.id, draft.version);
    expect(second.updatedAt).toBe(first.updatedAt);
  });

  it('lists versions chronologically with status', async () => {
    const draft = await definitions.saveWorkingCopy(makeForm([makeField('a')]));
    await definitions.publish(draft.id, draft.version);
    const v2 = await definitions.getOrCreateWorkingCopy(draft.id);
    await definitions.saveWorkingCopy({ ...v2, title: 'v2 edits' });

    const versions = await definitions.listVersions(draft.id);
    expect(versions.map((v) => v.version)).toEqual([1, 2]);
    expect(versions[0].status).toBe('published');
    expect(versions[1].status).toBe('draft');
  });

  it('list() returns only the latest live version per form and hides archived', async () => {
    const a = await definitions.saveWorkingCopy(makeForm([makeField('a')], [], { title: 'A' }));
    await definitions.publish(a.id, a.version);
    await definitions.saveWorkingCopy(makeForm([makeField('b')], [], { id: 'form-2', title: 'B' }));

    let listed = await definitions.list();
    expect(listed.map((f) => f.title).sort()).toEqual(['A', 'B']);

    await definitions.archive(a.id);
    listed = await definitions.list();
    expect(listed.map((f) => f.title)).toEqual(['B']);
  });

  it('getLatestPublished returns null before first publish', async () => {
    const draft = await definitions.saveWorkingCopy(makeForm([makeField('a')]));
    expect(await definitions.getLatestPublished(draft.id)).toBeNull();
  });

  it('counts responses per version', async () => {
    const def = makeForm([makeField('a'), makeField('b', 'text')]);
    def.dependencies = [showWhen('a', 'x', 'b')];
    const draft = await definitions.saveWorkingCopy(def);
    const published = await definitions.publish(draft.id, draft.version);

    await responses.save({
      id: 'r1',
      formId: published.id,
      formVersion: published.version,
      values: { a: 'x' },
      submittedAt: new Date().toISOString(),
    });
    await responses.save({
      id: 'r2',
      formId: published.id,
      formVersion: published.version,
      values: {},
      submittedAt: new Date().toISOString(),
    });

    const counts = await definitions.countResponsesByVersion!(published.id);
    expect(counts[published.version]).toBe(2);
  });

  it('stores one draft per form+respondent and discards by id', async () => {
    const def = makeForm([makeField('a')]);
    const savedDef = await definitions.saveWorkingCopy(def);

    await responses.saveDraft({
      id: 'd1',
      formId: savedDef.id,
      formVersion: 1,
      respondentContext: 'user-1',
      values: { a: 'half' },
      updatedAt: new Date().toISOString(),
    });

    const found = await responses.getDraft(savedDef.id, 'user-1');
    expect(found?.values['a']).toBe('half');

    // different respondent → different draft slot
    expect(await responses.getDraft(savedDef.id, 'user-2')).toBeNull();

    await responses.discardDraft('d1');
    expect(await responses.getDraft(savedDef.id, 'user-1')).toBeNull();
  });

  it('round-trips responses by form with newest first', async () => {
    const older = new Date(Date.now() - 60_000).toISOString();
    await responses.save({ id: 'r-old', formId: 'f', formVersion: 1, values: {}, submittedAt: older });
    await responses.save({
      id: 'r-new',
      formId: 'f',
      formVersion: 1,
      values: {},
      submittedAt: new Date().toISOString(),
    });
    const list = await responses.listByForm('f');
    expect(list.map((r) => r.id)).toEqual(['r-new', 'r-old']);
  });
});
