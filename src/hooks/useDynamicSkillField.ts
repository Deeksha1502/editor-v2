import { useTreeStore } from '../store/tree.store';
import { deepestCategoryCode } from './useRefreshQuestionSetBody';
import type { IFramework } from '../types/framework';
import { queryClient } from '../queryClient';

/** The field Dynamic pool questions carry their skill in: the framework's deepest category (e.g. "topic" on BMGS), else "skill". */
export function useDynamicSkillField(): string {
  const framework = useTreeStore((s) => {
    const root = s.treeData[0];
    return String((root ? s.treeCache[root.identifier]?.framework : undefined) ?? root?.metadata?.framework ?? '');
  });
  return deepestCategoryCode(queryClient.getQueryData<IFramework>(['framework', framework]));
}
