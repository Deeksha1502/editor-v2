import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { buildSavePayload } from './useSaveHierarchy';
import { queryClient } from '../queryClient';
import type { INode } from '../types/editor';

// Active framework BMGS has no `skill` category (its deepest is `topic`); a cached USF does, so `skill` is a known code.
const root: INode = { id: 'do_root', identifier: 'do_root', name: 'Set', children: [] } as INode;
const rootMeta = (primaryCategory: string, cache: Record<string, unknown>) =>
  (buildSavePayload([root], { do_root: cache }, 'ch', primaryCategory).nodesModified.do_root as { metadata: Record<string, unknown> }).metadata;

describe('buildSavePayload taxonomy cleanup', () => {
  beforeEach(() => {
    queryClient.setQueryData(['framework', 'BMGS'], { identifier: 'BMGS', categories: [{ code: 'board' }, { code: 'topic' }] });
    queryClient.setQueryData(['framework', 'USF'], { identifier: 'USF', categories: [{ code: 'skill' }] });
  });
  afterEach(() => queryClient.clear());

  it('keeps a Dynamic QuestionSet root skill when the active framework has no skill category (positive)', () => {
    expect(rootMeta('Dynamic QuestionSet', { framework: 'BMGS', skill: ['Algebra'] }).skill).toEqual(['Algebra']);
  });

  it('does not blank an unedited Dynamic skill on an unrelated save (positive)', () => {
    expect(rootMeta('Dynamic QuestionSet', { framework: 'BMGS', name: 'Renamed' })).not.toHaveProperty('skill');
  });

  it('still clears a skill value that is stale for other categories (negative)', () => {
    expect(rootMeta('Practice Question Set', { framework: 'BMGS', skill: ['Algebra'] }).skill).toEqual([]);
  });
});
