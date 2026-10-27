import { describe, it, expect } from 'vitest';
import { pickForLearner, withDynamicDraw, isGenerationStale, isGenerationComplete, needsGeneration, selectedSkills } from './dynamicAssessDraw';
import type { INode } from '../types/editor';

const q = (id: string, level: string): INode => ({ id, identifier: id, name: id, isQuestion: true, metadata: { difficultyLevel: level } });
const root = (children: INode[], target: unknown = { E: 1, M: 2, D: 0 }): INode => ({
  id: 'do_qs', identifier: 'do_qs', name: 'QS', primaryCategory: 'Dynamic QuestionSet', children, metadata: { difficultyTarget: target },
});
const pool = [...['e0', 'e1', 'e2'].map((i) => q(i, 'EASY')), ...['m0', 'm1', 'm2', 'm3', 'm4', 'm5'].map((i) => q(i, 'MEDIUM'))];

describe('withDynamicDraw', () => {
  it("shows only the user's target-sized draw per level, the same every time (positive)", () => {
    const shown = withDynamicDraw(root(pool), {}, 'u1').children ?? [];
    expect(shown.filter((c) => c.metadata?.difficultyLevel === 'EASY')).toHaveLength(1);
    expect(shown.filter((c) => c.metadata?.difficultyLevel === 'MEDIUM')).toHaveLength(2);
    expect(withDynamicDraw(root(pool), {}, 'u1').children).toEqual(shown);
  });

  it('draws the same set the portal player gives this user (shared seed format)', () => {
    const shownMedium = (withDynamicDraw(root(pool), {}, 'u1').children ?? []).filter((c) => c.metadata?.difficultyLevel === 'MEDIUM').map((c) => c.identifier).sort();
    expect(shownMedium).toEqual(pickForLearner(['m0', 'm1', 'm2', 'm3', 'm4', 'm5'], 2, 'u1:do_qs:MEDIUM').sort());
  });

  it('prefers treeCache edits for the target and leaves the stored children untouched', () => {
    const r = root(pool);
    const shown = withDynamicDraw(r, { do_qs: { difficultyTarget: '{"E":0,"M":1,"D":0}' } }, 'u1').children ?? [];
    expect(shown).toHaveLength(1);
    expect(r.children).toHaveLength(9);
  });

  it('leaves non-Dynamic sets unchanged (negative)', () => {
    const plain = { ...root(pool), primaryCategory: 'Practice Question Set' };
    expect(withDynamicDraw(plain, {}, 'u1')).toBe(plain);
  });

  it('shows nothing, never the pool, for a zero or invalid target (positive)', () => {
    expect(withDynamicDraw(root(pool, { E: 0, M: 0, D: 0 }), {}, 'u1').children).toEqual([]);
    expect(withDynamicDraw(root(pool, 'not json'), {}, 'u1').children).toEqual([]);
  });

  it('caps each level at its generated size when the target is raised without regenerating (positive)', () => {
    // 3 Easy + 6 Medium were generated for E1 M2, so an unsaved E9 M9 still shows only 1 + 2.
    const shown = withDynamicDraw(root(pool), { do_qs: { difficultyTarget: { E: 9, M: 9, D: 0 } } }, 'u1').children ?? [];
    expect(shown.filter((c) => c.metadata?.difficultyLevel === 'EASY')).toHaveLength(1);
    expect(shown.filter((c) => c.metadata?.difficultyLevel === 'MEDIUM')).toHaveLength(2);
  });

  it('shows nothing when a Dynamic root holds only sections (positive)', () => {
    const section: INode = { id: 's1', identifier: 's1', name: 'Section', isFolder: true, children: pool };
    expect(withDynamicDraw(root([section]), {}, 'u1').children).toEqual([]);
  });

  it('never shows non-question children such as sections (positive)', () => {
    const section: INode = { id: 's1', identifier: 's1', name: 'Section', isFolder: true, children: pool };
    expect(withDynamicDraw(root([...pool, section]), {}, 'u1').children?.some((c) => c.identifier === 's1')).toBe(false);
  });
});

describe('draw golden vector (identical in generic-editor-v2 and the portal)', () => {
  it('picks the same ids for a fixed seed in every copy', () => {
    expect(pickForLearner(['q1', 'q2', 'q3', 'q4', 'q5', 'q6'], 2, 'user-1:do_123:EASY')).toEqual(['q6', 'q3']);
  });
});

describe('isGenerationComplete', () => {
  it('is complete only at exactly target x 3 per level (positive)', () => {
    expect(isGenerationComplete(root(pool))).toBe(true);
  });

  it('is not complete mid-write while old and new children are both attached, or when empty (negative)', () => {
    expect(isGenerationComplete(root([...pool, q('old1', 'EASY')]))).toBe(false);
    expect(isGenerationComplete(root([]))).toBe(false);
    expect(isGenerationComplete(undefined)).toBe(false);
  });
});

describe('isGenerationStale', () => {
  const sq = (id: string, level: string, skill: unknown = ['Physics']): INode => ({ ...q(id, level), metadata: { difficultyLevel: level, skill } });
  // Target E1 M2 D0 generated with multiplier 3 -> 3 Easy + 6 Medium children.
  const generated = () => [...['e0', 'e1', 'e2'].map((i) => sq(i, 'EASY')), ...['m0', 'm1', 'm2', 'm3', 'm4', 'm5'].map((i) => sq(i, 'MEDIUM'))];
  const qs = (children: INode[], meta: Record<string, unknown> = {}): INode => ({
    ...root(children), metadata: { difficultyTarget: { E: 1, M: 2, D: 0 }, skill: ['Physics'], ...meta },
  });

  it('is not stale while settings match the generated children (negative)', () => {
    expect(isGenerationStale(qs(generated()), {})).toBe(false);
  });

  it('flags a target changed after generation, including unsaved form edits (positive)', () => {
    expect(isGenerationStale(qs(generated(), { difficultyTarget: { E: 1, M: 1, D: 0 } }), {})).toBe(true);
    expect(isGenerationStale(qs(generated()), { do_qs: { difficultyTarget: '{"E":2,"M":2,"D":0}' } })).toBe(true);
  });

  it('flags an added or swapped skill (positive)', () => {
    expect(isGenerationStale(qs(generated(), { skill: ['Physics', 'Chemistry'] }), {})).toBe(true);
    expect(isGenerationStale(qs(generated()), { do_qs: { skill: ['Chemistry'] } })).toBe(true);
  });

  it('skips the skill check when the pool children carry no skill (negative)', () => {
    const noSkill = generated().map((c) => ({ ...c, metadata: { difficultyLevel: c.metadata?.difficultyLevel } }));
    expect(isGenerationStale(qs(noSkill, { skill: ['Anything'] }), {})).toBe(false);
  });

  it('treats a section under a Dynamic root as needing regeneration, since generation only writes questions (positive)', () => {
    expect(isGenerationStale(qs([{ id: 's', identifier: 's', name: 's', isFolder: true }]), {})).toBe(true);
  });

  it('reads the selection and the questions\' skills from the framework\'s deepest category, e.g. topic (positive)', () => {
    const topicPool = generated().map((c) => ({ ...c, metadata: { difficultyLevel: c.metadata?.difficultyLevel, topic: ['Algebra'] } }));
    expect(isGenerationStale(qs(topicPool, { topic: ['Algebra'] }), {}, undefined, 'topic')).toBe(false);
    expect(isGenerationStale(qs(topicPool, { topic: ['Geometry'] }), {}, undefined, 'topic')).toBe(true);
  });

  it('ignores empty sets and non-Dynamic sets (negative)', () => {
    expect(isGenerationStale(qs([]), {})).toBe(false);
    expect(isGenerationStale({ ...qs(generated(), { difficultyTarget: { E: 9 } }), primaryCategory: 'Practice Question Set' }, {}, 'Practice Question Set')).toBe(false);
  });
});

describe('needsGeneration (Save also generates only when needed)', () => {
  const sq = (id: string, level: string): INode => ({ ...q(id, level), metadata: { difficultyLevel: level, skill: ['Physics'] } });
  const generated = () => [...['e0', 'e1', 'e2'].map((i) => sq(i, 'EASY')), ...['m0', 'm1', 'm2', 'm3', 'm4', 'm5'].map((i) => sq(i, 'MEDIUM'))];
  const set = (children: INode[], meta: Record<string, unknown> = {}): INode => ({
    ...root(children), metadata: { difficultyTarget: { E: 1, M: 2, D: 0 }, skill: ['Physics'], ...meta },
  });

  it('generates on the first save that has Skill and Difficulty Target (positive)', () => {
    expect(needsGeneration(set([]), {})).toBe(true);
  });

  it('generates again when Skill or Target changed, including unsaved edits (positive)', () => {
    expect(needsGeneration(set(generated()), { do_qs: { difficultyTarget: { E: 2, M: 2, D: 0 } } })).toBe(true);
    expect(needsGeneration(set(generated()), { do_qs: { skill: ['Physics', 'Chemistry'] } })).toBe(true);
  });

  it('is a plain save for any other edit, e.g. a spelling fix in the name (negative)', () => {
    expect(needsGeneration(set(generated()), { do_qs: { name: 'Fixed typo' } })).toBe(false);
  });

  it('is a plain save while Skill or Target is incomplete, and for non-Dynamic sets (negative)', () => {
    expect(needsGeneration(set([], { skill: [] }), {})).toBe(false);
    expect(needsGeneration(set([], { difficultyTarget: { E: 0, M: 0, D: 0 } }), {})).toBe(false);
    expect(needsGeneration({ ...set([]), primaryCategory: 'Practice Question Set' }, {}, 'Practice Question Set')).toBe(false);
  });
});

describe('selectedSkills (the selection lives in the framework\'s deepest category field)', () => {
  it('reads that field, deduped, whether it holds a list or one value (positive)', () => {
    expect(selectedSkills({ topic: ['Algebra', 'Algebra', 'Geometry'], skill: ['Ignored'] }, 'topic')).toEqual(['Algebra', 'Geometry']);
    expect(selectedSkills({ topic: 'Algebra' }, 'topic')).toEqual(['Algebra']);
  });

  it('is empty when the field is missing or blank (negative)', () => {
    expect(selectedSkills({ skill: ['Physics'] }, 'topic')).toEqual([]);
    expect(selectedSkills({ topic: [] }, 'topic')).toEqual([]);
  });
});

describe('needsGeneration with a non-"skill" deepest category', () => {
  const dq = (id: string, level: string): INode => ({ id, identifier: id, name: id, isQuestion: true, metadata: { difficultyLevel: level, topic: ['Algebra'] } } as INode);
  const set = (children: INode[], meta: Record<string, unknown>): INode =>
    ({ id: 'do_root', identifier: 'do_root', name: 'Set', primaryCategory: 'Dynamic QuestionSet', children, metadata: { difficultyTarget: { E: 1, M: 0, D: 0 }, ...meta } } as INode);

  it('generates on the first save once topic holds the selection (positive)', () => {
    expect(needsGeneration(set([], { topic: ['Algebra'] }), {}, undefined, 'topic')).toBe(true);
  });

  it('does not treat a stray skill value as the selection when the framework\'s category is topic (negative)', () => {
    expect(needsGeneration(set([], { skill: ['Algebra'] }), {}, undefined, 'topic')).toBe(false);
    const generated = ['e0', 'e1', 'e2'].map((i) => dq(i, 'EASY'));
    expect(needsGeneration(set(generated, { topic: ['Algebra'] }), {}, undefined, 'topic')).toBe(false);
  });
});
