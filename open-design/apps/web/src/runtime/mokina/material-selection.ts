import { joinMokinaExcerpt, type ProjectMaterialExtraction } from '@open-design/contracts';

/** Pure grouping/rendering helpers shared by the material picker surfaces. */

// File classes Mokina context selection understands. Shared by the
// in-project 资料与背景 panel and the Home attachment band so both
// surfaces agree on what can become 资料摘录 vs 素材.
export const MOKINA_ASSET_FILE_PATTERN = /\.(?:png|jpe?g|webp|gif|svg)$/i;
export const MOKINA_MATERIAL_FILE_PATTERN = /\.(?:txt|md|csv|pdf|docx|xlsx|pptx)$/i;

export function isMokinaMaterialFileName(name: string): boolean {
  return MOKINA_MATERIAL_FILE_PATTERN.test(name);
}

export function isMokinaAssetFileName(name: string): boolean {
  return MOKINA_ASSET_FILE_PATTERN.test(name);
}

export type MokinaSelectionGroup = {
  key: string;
  name: string;
  label: string;
  sections: ProjectMaterialExtraction['sections'];
  chars: number;
};

export function groupMokinaMaterialSections(materials: ProjectMaterialExtraction[]): MokinaSelectionGroup[] {
  const groups: MokinaSelectionGroup[] = [];
  for (const material of materials) {
    let previousId = '';
    let part = 0;
    let current: MokinaSelectionGroup | null = null;
    for (const [sourceIndex, section] of material.sections.entries()) {
      const id = section.groupId ?? section.location;
      if (id !== previousId) part = 0;
      if (!current || id !== previousId || current.chars + section.text.length + 2 > 8_000) {
        if (id === previousId) part++;
        current = {
          // Display groups may recur after a table. Anchor each selectable range
          // to its first source fragment, not its repeated heading/part label.
          // Legacy extractions have no fragment IDs; their source index is only
          // a render identity, never a migration of an ambiguous old selection.
          key: JSON.stringify([material.name, material.contentDigest, material.parserVersion ?? null,
            section.fragmentId ?? `legacy:${sourceIndex}`]),
          name: material.name,
          label: `${section.groupLabel ?? section.location}${part ? ` / 片段 ${part + 1}` : ''}`,
          sections: [],
          chars: 0,
        };
        groups.push(current);
      }
      current.sections.push(section);
      current.chars = joinMokinaExcerpt(current.sections.map(fragment => fragment.text)).length;
      previousId = id;
    }
  }
  return groups;
}

export function buildMokinaMaterialSnapshot(
  materials: ProjectMaterialExtraction[],
  groups: MokinaSelectionGroup[],
  selectedKeys: string[],
): string {
  const chosen = groups.filter(group => selectedKeys.includes(group.key));
  return [
    '# 本次选入资料的固定摘录',
    '以下仅包含用户本次勾选的资料段落；位置指向当次提取的原件。未勾选内容不在此工作空间中。',
    ...materials.filter(material => chosen.some(group => group.name === material.name)).map(material => [
      `## ${material.name}`,
      `提取状态：${material.status === 'partial' ? '部分读取' : '已读取'}`,
      ...material.limitations.map(value => `读取限制：${value}`),
      ...(material.groupLimitations ?? [])
        .filter(limitation => chosen
          .filter(group => group.name === material.name)
          .some(group => group.sections.some(section => section.groupId === limitation.groupId
            || section.groupId?.startsWith(`${limitation.groupId}:part:`))))
        .map(limitation => `读取限制：${limitation.location}：${limitation.message}`),
      ...chosen.filter(group => group.name === material.name).flatMap(group =>
        group.sections.map(section => `### ${section.location}\n${section.text}`)),
    ].join('\n\n')),
  ].join('\n\n');
}

/**
 * The parser splits oversized fragments as `<groupId>:part:N`; the snapshot API
 * selects by the BASE group id and re-expands parts itself, so selections must
 * pass the base id or the exact part would be silently widened/narrowed.
 */
export function baseMokinaGroupId(groupId: string): string {
  return groupId.replace(/:part:\d+$/u, '');
}
