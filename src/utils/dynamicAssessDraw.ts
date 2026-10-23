import type { INode } from '../types/editor';
import { toDifficultyTarget } from '../components/SparkMetaForm/SparkMetaForm';

// Same seeded draw as the portal's dynamicAssessSubset, so the editor shows the user the exact set they'd play; the full pool is never displayed.

const LEVELS = [['E', 'EASY'], ['M', 'MEDIUM'], ['D', 'DIFFICULT']] as const;

/** Dynamic Assess: each difficulty needs requested x this many Live questions; must match the backend's dynamicassess.multiplier. */
export const DYNAMIC_ASSESS_POOL_MULTIPLIER = 3;

/** Dynamic Assess: each selected skill must contribute at least this many questions; must match the backend's dynamicassess.minCriteria. */
export const DYNAMIC_ASSESS_MIN_CRITERIA = 2;

function hashSeed(seed: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function seededRandom(seed: string): () => number {
  let a = hashSeed(seed);
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function pickForLearner(ids: string[], count: number, seed: string): string[] {
  const pool = [...new Set(ids)].sort();
  if (count >= pool.length) return pool;
  const rand = seededRandom(seed);
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    const swap = pool[i] as string;
    pool[i] = pool[j] as string;
    pool[j] = swap;
  }
  return pool.slice(0, Math.max(0, count));
}

const levelOf = (c: INode, treeCache: Record<string, Record<string, unknown>>) =>
  String(c.metadata?.difficultyLevel ?? treeCache[c.identifier]?.difficultyLevel ?? '').toUpperCase();

/** Ids of the root's questions this user should see, or null when the root isn't a Dynamic QuestionSet (show everything). */
export function visibleDynamicQuestionIds(
  root: INode | undefined, treeCache: Record<string, Record<string, unknown>>, userId: string, primaryCategory?: string,
): Set<string> | null {
  if (!root) return null;
  const meta = { ...(root.metadata ?? {}), ...(treeCache[root.identifier] ?? {}) } as Record<string, unknown>;
  if ((primaryCategory ?? root.primaryCategory ?? meta.primaryCategory) !== 'Dynamic QuestionSet') return null;
  const target = toDifficultyTarget(meta.difficultyTarget);
  const children = root.children ?? [];
  const questions = children.filter((c) => c.isQuestion);
  if (children.length === 0) return null;
  if (questions.length === 0) return new Set(); // only sections/folders: never show them (or questions nested in them)
  // Fails closed: an unsaved target above what was generated (or a zero/invalid one) must never reveal the pool, so each level is capped at its generated size.
  const visible = new Set<string>();
  for (const [key, level] of LEVELS) {
    const atLevel = questions.filter((c) => levelOf(c, treeCache) === level).map((c) => c.identifier);
    const count = Math.min(target[key] ?? 0, Math.floor(atLevel.length / DYNAMIC_ASSESS_POOL_MULTIPLIER));
    pickForLearner(atLevel, count, `${userId || 'anonymous'}:${root.identifier}:${level}`).forEach((id) => visible.add(id));
  }
  return visible;
}

/** The root with only this user's draw as children; other trees are returned unchanged. */
export function withDynamicDraw(root: INode, treeCache: Record<string, Record<string, unknown>>, userId: string, primaryCategory?: string): INode {
  const visible = visibleDynamicQuestionIds(root, treeCache, userId, primaryCategory);
  if (!visible) return root;
  return { ...root, children: (root.children ?? []).filter((c) => visible.has(c.identifier)) };
}

/** True when the root's current skill/difficultyTarget no longer match its generated children: the job publishes exactly target x multiplier per level and tags each child with its skill. */
export function isGenerationStale(
  root: INode | undefined, treeCache: Record<string, Record<string, unknown>>, primaryCategory?: string, skillField = 'skill',
): boolean {
  if (!root) return false;
  const meta = { ...(root.metadata ?? {}), ...(treeCache[root.identifier] ?? {}) } as Record<string, unknown>;
  if ((primaryCategory ?? root.primaryCategory ?? meta.primaryCategory) !== 'Dynamic QuestionSet') return false;
  const children = root.children ?? [];
  if (children.length === 0) return false;
  // Generation only ever writes questions, so anything else under a Dynamic root means it needs regenerating.
  if (children.some((c) => !c.isQuestion)) return true;
  const field = (c: INode, key: string) => c.metadata?.[key] ?? treeCache[c.identifier]?.[key];
  const target = toDifficultyTarget(meta.difficultyTarget);
  for (const [key, level] of LEVELS) {
    const count = children.filter((c) => String(field(c, 'difficultyLevel') ?? '').toUpperCase() === level).length;
    if (count !== (target[key] ?? 0) * DYNAMIC_ASSESS_POOL_MULTIPLIER) return true;
  }
  const saved = new Set((Array.isArray(meta.skill) ? meta.skill : []).map(String));
  // Pool questions carry the skill in the framework's deepest category (e.g. "topic"), which the form shows as Skill.
  const skillsOf = (c: INode) => { const v = field(c, skillField); return (Array.isArray(v) ? v : v ? [v] : []).map(String); };
  // Children with no value in that field (e.g. the framework hasn't loaded, so the field is unknown) leave only the target to check.
  if (!children.some((c) => skillsOf(c).length)) return false;
  const covered = new Set(children.flatMap(skillsOf).filter((s) => saved.has(s)));
  return covered.size !== saved.size || children.some((c) => !skillsOf(c).some((s) => saved.has(s)));
}

/** True once the job has fully written the pool for the root's saved target: exactly target x multiplier questions per level, after both its /add and /remove. */
export function isGenerationComplete(root: INode | undefined): boolean {
  if (!root) return false;
  const children = root.children ?? [];
  if (children.length === 0 || children.some((c) => !c.isQuestion)) return false;
  const target = toDifficultyTarget(root.metadata?.difficultyTarget);
  return LEVELS.every(([key, level]) =>
    children.filter((c) => levelOf(c, {}) === level).length === (target[key] ?? 0) * DYNAMIC_ASSESS_POOL_MULTIPLIER);
}

/** Save must also generate when the set has usable Skill + Difficulty Target and either no questions yet or questions built for other settings; any other save is a plain save. */
export function needsGeneration(
  root: INode | undefined, treeCache: Record<string, Record<string, unknown>>, primaryCategory?: string, skillField = 'skill',
): boolean {
  if (!root) return false;
  const meta = { ...(root.metadata ?? {}), ...(treeCache[root.identifier] ?? {}) } as Record<string, unknown>;
  if ((primaryCategory ?? root.primaryCategory ?? meta.primaryCategory) !== 'Dynamic QuestionSet') return false;
  const target = toDifficultyTarget(meta.difficultyTarget);
  const hasInputs = Array.isArray(meta.skill) && meta.skill.length > 0 && (target.E ?? 0) + (target.M ?? 0) + (target.D ?? 0) > 0;
  if (!hasInputs) return false;
  return !(root.children ?? []).some((c) => c.isQuestion) || isGenerationStale(root, treeCache, primaryCategory, skillField);
}
