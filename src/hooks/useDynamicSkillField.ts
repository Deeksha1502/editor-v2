import { useQuery } from '@tanstack/react-query';
import { useTreeStore } from '../store/tree.store';
import { deepestCategoryCode } from './useRefreshQuestionSetBody';
import { useIsDynamicAssess } from './useIsDynamicAssess';
import { getFramework } from '../api/framework';
import type { IFramework } from '../types/framework';

/** The field Dynamic pool questions carry their skill in: the framework's deepest category (e.g. "topic" on BMGS), else "skill". */
export function useDynamicSkillField(): string {
  const isDynamicAssess = useIsDynamicAssess();
  const framework = useTreeStore((s) => {
    const root = s.treeData[0];
    return String((root ? s.treeCache[root.identifier]?.framework : undefined) ?? root?.metadata?.framework ?? '');
  });
  // Subscribed (same key and staleTime as useFramework), so the field updates once the framework loads; never runs for other categories.
  const { data } = useQuery<IFramework>({
    queryKey: ['framework', framework],
    queryFn: () => getFramework(framework),
    enabled: isDynamicAssess && !!framework,
    staleTime: 10 * 60 * 1000,
  });
  return deepestCategoryCode(data);
}
