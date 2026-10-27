import { useLabels } from '../../hooks/useLabels';
import { useDynamicSkillField } from '../../hooks/useDynamicSkillField';
import { dynamicAssessSettings, selectedSkills } from '../../utils/dynamicAssessDraw';
import type { DifficultyTarget } from './SparkMetaForm';

/** Dynamic Assess: the set's own per-skill minimum against the live Difficulty Target, once a skill is selected; Save is still blocked by the pool check. */
export function MinQuestionsPanel({ values, target }: { values: Record<string, unknown>; target: DifficultyTarget }) {
  const L = useLabels();
  const skillField = useDynamicSkillField();
  const skillCount = selectedSkills(values, skillField).length;
  if (!skillCount) return null;

  const { minCriteria } = dynamicAssessSettings(values);
  const total = (target.E ?? 0) + (target.M ?? 0) + (target.D ?? 0);
  const minimum = minCriteria * skillCount;
  const short = total < minimum;
  const fill = (text: string) => text
    .replace('{MIN}', String(minCriteria)).replace('{MINIMUM}', String(minimum)).replace('{TOTAL}', String(total));

  return (
    <div
      role="status"
      data-testid="dynamic-assess-min-panel"
      style={{ marginTop: 12, padding: '12px 14px', border: `1px solid ${short ? 'var(--sb-red-border)' : 'var(--sb-border)'}`, borderRadius: 8 }}
    >
      <div style={{ fontSize: 13, fontWeight: 600 }}>{L('ui.dynamicAssessMinTitle', 'Minimum questions per skill')}</div>
      <p style={{ margin: '4px 0 10px', fontSize: 13, color: 'var(--sb-text-muted)' }}>
        {short
          ? fill(L('ui.dynamicAssessMinNeeds', 'Each selected skill needs at least {MIN} questions; increase the total to at least {MINIMUM}.'))
          : fill(L('ui.dynamicAssessMinOk', 'Each selected skill needs at least {MIN} questions.'))}
      </p>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, fontSize: 12, color: 'var(--sb-text-muted)' }}>
        <span>{fill(L('ui.dynamicAssessMinFooter', 'Total: {TOTAL} · Minimum: {MINIMUM}'))}</span>
        {short && (
          <span style={{ padding: '2px 8px', borderRadius: 999, fontWeight: 600, color: 'var(--sb-red)', background: 'var(--sb-red-soft)', border: '1px solid var(--sb-red-border)' }}>
            {L('ui.dynamicAssessNeedsAdjustment', 'Needs adjustment')}
          </span>
        )}
      </div>
    </div>
  );
}
