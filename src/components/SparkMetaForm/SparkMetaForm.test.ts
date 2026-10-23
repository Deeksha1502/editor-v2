import { describe, it, expect } from 'vitest';
import { findMissingRequiredFields, adaptFieldsForFramework } from './SparkMetaForm';
import type { FrameworkTerm } from './SparkMetaForm';
import type { ICategoryField } from '../../api/categoryDefinition';

function difficultyTargetField(required = true): ICategoryField {
  return {
    code: 'difficultyTarget',
    label: 'Difficulty Target',
    required,
    editable: true,
    visible: true,
  };
}

describe('difficultyTarget field validation (Dynamic Assess)', () => {
  it('is missing when required and every count is zero/absent', () => {
    const fields = [difficultyTargetField()];
    expect(findMissingRequiredFields(fields, {})).toHaveLength(1);
    expect(findMissingRequiredFields(fields, { difficultyTarget: { E: 0, M: 0, D: 0 } })).toHaveLength(1);
  });

  it('is satisfied once at least one bucket has a positive count', () => {
    const fields = [difficultyTargetField()];
    expect(findMissingRequiredFields(fields, { difficultyTarget: { E: 3, M: 0, D: 0 } })).toHaveLength(0);
    expect(findMissingRequiredFields(fields, { difficultyTarget: { E: 1, M: 2, D: 3 } })).toHaveLength(0);
  });

  it('is never reported missing when not required', () => {
    const fields = [difficultyTargetField(false)];
    expect(findMissingRequiredFields(fields, {})).toHaveLength(0);
  });

  it('parses the real API wire format — a JSON string, not a native object (positive)', () => {
    // The API round-trips difficultyTarget JSON-stringified, matching the OCD's string type.
    const fields = [difficultyTargetField()];
    expect(findMissingRequiredFields(fields, { difficultyTarget: '{"E":3,"M":2,"D":1}' })).toHaveLength(0);
    expect(findMissingRequiredFields(fields, { difficultyTarget: '{"E":0,"M":0,"D":0}' })).toHaveLength(1);
  });

  it('treats an unparseable string as empty rather than throwing (negative)', () => {
    const fields = [difficultyTargetField()];
    expect(() => findMissingRequiredFields(fields, { difficultyTarget: 'not json' })).not.toThrow();
    expect(findMissingRequiredFields(fields, { difficultyTarget: 'not json' })).toHaveLength(1);
  });
});

describe('skill field always binds to the active framework\'s deepest category (Dynamic Assess)', () => {
  const frameworkTerms = new Map<string, FrameworkTerm[]>([
    ['subject', [{ name: 'Physics', identifier: 'physics', code: 'physics' }]],
    // "topic" stands in for a deepest category not named "skill" (e.g. BMGS).
    ['topic', [{ name: 'Mechanics', identifier: 'mechanics', code: 'mechanics' }]],
  ]);
  const categoryOrder = ['subject', 'topic']; // ascending index — 'topic' is deepest

  it('overrides a mismatched static sourceCategory with the deepest category code', () => {
    // Static sourceCategory says 'skill', but this framework's deepest category is 'topic'.
    const fields: ICategoryField[] = [
      { code: 'skill', label: 'Skill', required: true, editable: true, visible: true, sourceCategory: 'skill' },
    ];
    const adapted = adaptFieldsForFramework(fields, frameworkTerms, categoryOrder, true, true);
    const skillField = adapted.find((f) => f.code === 'skill');
    expect(skillField?.sourceCategory).toBe('topic');
  });

  it('resolves correctly even with no static sourceCategory at all', () => {
    const fields: ICategoryField[] = [
      { code: 'skill', label: 'Skill', required: true, editable: true, visible: true },
    ];
    const adapted = adaptFieldsForFramework(fields, frameworkTerms, categoryOrder, true, true);
    const skillField = adapted.find((f) => f.code === 'skill');
    expect(skillField?.sourceCategory).toBe('topic');
  });

  it('leaves a skill field on a non-Dynamic question set bound as before (negative)', () => {
    const bound: ICategoryField[] = [
      { code: 'skill', label: 'Skill', required: true, editable: true, visible: true, sourceCategory: 'skill' },
    ];
    expect(adaptFieldsForFramework(bound, frameworkTerms, categoryOrder, true, false).find((f) => f.code === 'skill')?.sourceCategory).toBe('skill');
    const unbound: ICategoryField[] = [
      { code: 'skill', label: 'Skill', required: true, editable: true, visible: true },
    ];
    expect(adaptFieldsForFramework(unbound, frameworkTerms, categoryOrder, true, false).find((f) => f.code === 'skill')).toBeUndefined();
  });
});
