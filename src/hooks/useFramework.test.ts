import { describe, it, expect } from 'vitest';
import { highestIndexCategoryCode, orderCategoryCodes } from './useFramework';

describe('highestIndexCategoryCode (same rule as knowlg-service and the knowlg-publish job)', () => {
  it('picks the highest index regardless of array order (positive)', () => {
    expect(highestIndexCategoryCode([{ code: 'topic', index: 3 }, { code: 'board', index: 1 }])).toBe('topic');
  });

  it('keeps the first category on an index tie, like Scala maxBy (positive)', () => {
    expect(highestIndexCategoryCode([{ code: 'subject', index: 4 }, { code: 'topic', index: 4 }])).toBe('subject');
  });

  it('counts a missing index as 0, so it never wins over an indexed category (negative)', () => {
    expect(highestIndexCategoryCode([{ code: 'extra' }, { code: 'topic', index: 2 }])).toBe('topic');
    expect(highestIndexCategoryCode([])).toBeUndefined();
  });
});

describe('orderCategoryCodes', () => {
  const tied = [{ code: 'board', index: 1 }, { code: 'subject', index: 4 }, { code: 'topic', index: 4 }];
  const gap = [{ code: 'board', index: 1 }, { code: 'topic', index: 2 }, { code: 'extra' }];

  it('ends with the backend skill category for Dynamic Assess, on ties and missing indexes (positive)', () => {
    expect(orderCategoryCodes(tied, true).slice(-1)[0]).toBe('subject');
    expect(orderCategoryCodes(gap, true).slice(-1)[0]).toBe('topic');
  });

  it('keeps every category exactly once (positive)', () => {
    expect([...orderCategoryCodes(gap, true)].sort()).toEqual(['board', 'extra', 'topic']);
  });

  it('leaves the order unchanged for other categories (negative)', () => {
    expect(orderCategoryCodes(tied, false)).toEqual(['board', 'subject', 'topic']);
    expect(orderCategoryCodes(gap, false)).toEqual(['board', 'topic', 'extra']);
  });

  it('matches the plain order for Dynamic Assess when indexes are distinct (negative)', () => {
    const usual = [{ code: 'board', index: 1 }, { code: 'medium', index: 2 }, { code: 'topic', index: 3 }];
    expect(orderCategoryCodes(usual, true)).toEqual(orderCategoryCodes(usual, false));
  });
});
