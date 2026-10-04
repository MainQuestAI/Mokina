import { readHtmlSections } from './sections.js';

/**
 * Structural deliverable checks for Mokina marketing HTML (T08).
 *
 * This is an engineering check, not a strategy review: the file must be a
 * readable HTML document with at least one addressable top-level section
 * (`id` + `data-mokina-id` agreeing, no duplicates, no nesting — enforced by
 * `readHtmlSections`). Which sections exist stays a task decision; the report
 * contract names the habitual set but nothing here enforces marketing content.
 */

export interface MokinaStructureInspection {
  ok: boolean;
  sectionIds: string[];
  problems: string[];
}

export function inspectMokinaHtmlStructure(content: string): MokinaStructureInspection {
  if (typeof content !== 'string' || content.trim().length === 0) {
    return { ok: false, sectionIds: [], problems: ['empty-document'] };
  }
  let sectionIds: string[];
  try {
    sectionIds = readHtmlSections(content).map((section) => section.id);
  } catch (error) {
    return {
      ok: false,
      sectionIds: [],
      problems: [error instanceof Error ? error.message : String(error)],
    };
  }
  if (sectionIds.length === 0) {
    return { ok: false, sectionIds, problems: ['no-addressable-sections'] };
  }
  return { ok: true, sectionIds, problems: [] };
}

/** True when the project's stored scenario binding marks a Mokina deliverable. */
export function isMokinaScenarioProject(metadata: unknown): boolean {
  if (metadata == null || typeof metadata !== 'object' || Array.isArray(metadata)) return false;
  const binding = (metadata as { scenarioBinding?: unknown }).scenarioBinding;
  if (binding == null || typeof binding !== 'object' || Array.isArray(binding)) return false;
  const pluginId = (binding as { pluginId?: unknown }).pluginId;
  return typeof pluginId === 'string' && pluginId.startsWith('mokina-');
}
