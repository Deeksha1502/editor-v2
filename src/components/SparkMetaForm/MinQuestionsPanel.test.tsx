import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, vi } from 'vitest';
import { MinQuestionsPanel } from './MinQuestionsPanel';
import SparkMetaForm from './SparkMetaForm';
import type { ICategoryField } from '../../api/categoryDefinition';

// The stores return their initial state under server rendering, so the category is switched through the hook.
const category = vi.hoisted(() => ({ dynamic: false }));
vi.mock('../../hooks/useIsDynamicAssess', () => ({ useIsDynamicAssess: () => category.dynamic }));

const render = (node: React.ReactElement) =>
  renderToStaticMarkup(<QueryClientProvider client={new QueryClient()}>{node}</QueryClientProvider>);

describe('MinQuestionsPanel', () => {
  it("shows the set's minimum per skill and flags a total below it (positive)", () => {
    const html = render(<MinQuestionsPanel values={{ skill: ['A', 'B'], minCriteria: 4 }} target={{ E: 1, M: 1, D: 1 }} />);
    expect(html).toContain('Minimum questions per skill');
    expect(html).toContain('increase the total to at least 8');
    expect(html).toContain('Total: 3 · Minimum: 8');
    expect(html).toContain('Needs adjustment');
  });

  it('drops the badge once the total meets the minimum, defaulting minCriteria to 2 (negative)', () => {
    const html = render(<MinQuestionsPanel values={{ skill: ['A'] }} target={{ E: 1, M: 1, D: 0 }} />);
    expect(html).toContain('Each selected skill needs at least 2 questions.');
    expect(html).toContain('Total: 2 · Minimum: 2');
    expect(html).not.toContain('Needs adjustment');
  });

  it('renders nothing until a skill is selected (negative)', () => {
    expect(render(<MinQuestionsPanel values={{ minCriteria: 4 }} target={{ E: 1, M: 0, D: 0 }} />)).toBe('');
  });
});

describe('SparkMetaForm difficultyTarget', () => {
  const fields = [{ code: 'difficultyTarget', label: 'Difficulty Target', visible: true, editable: true, section: 'Behaviour' }] as ICategoryField[];
  const values = { skill: ['A', 'B'], minCriteria: 4, difficultyTarget: '{"E":1,"M":1,"D":1}' };
  const form = (isRoot: boolean) => render(<SparkMetaForm fields={fields} values={values} onChange={() => {}} section="Behaviour" isRoot={isRoot} />);

  it("shows the panel under a Dynamic set root's target (positive)", () => {
    category.dynamic = true;
    expect(form(true)).toContain('Needs adjustment');
  });

  it('shows no panel for other question sets or below the root (negative)', () => {
    category.dynamic = false;
    expect(form(true)).not.toContain('Minimum questions per skill');
    category.dynamic = true;
    expect(form(false)).not.toContain('Minimum questions per skill');
  });
});
