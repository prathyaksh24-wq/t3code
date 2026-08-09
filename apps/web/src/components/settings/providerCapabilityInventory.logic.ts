import type { ServerProvider, ServerProviderCapabilityState } from "@t3tools/contracts";

import {
  formatProviderSkillDisplayName,
  formatProviderSkillInstallSource,
} from "../../providerSkillPresentation";

export interface ProviderCapabilityInventoryItem {
  readonly id: string;
  readonly name: string;
  readonly description?: string | undefined;
  readonly source: string;
  readonly state: ServerProviderCapabilityState;
}

export interface ProviderCapabilityInventoryGroup {
  readonly kind: string;
  readonly label: string;
  readonly reported: boolean;
  readonly items: ReadonlyArray<ProviderCapabilityInventoryItem>;
}

const KNOWN_CAPABILITY_GROUPS = [
  { kind: "skill", label: "Skills" },
  { kind: "slash-command", label: "Commands" },
  { kind: "mcp-server", label: "MCP servers" },
  { kind: "plugin", label: "Plugins" },
] as const;

function titleCaseKind(value: string): string {
  return value
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function buildProviderCapabilityInventory(
  provider: ServerProvider,
): ReadonlyArray<ProviderCapabilityInventoryGroup> {
  const providerLabel = provider.displayName ?? String(provider.driver);
  const reportedKinds = new Set(provider.reportedCapabilityKinds ?? []);
  const itemsByKind = new Map<string, ProviderCapabilityInventoryItem[]>();

  const addItem = (kind: string, item: ProviderCapabilityInventoryItem) => {
    const items = itemsByKind.get(kind) ?? [];
    items.push(item);
    itemsByKind.set(kind, items);
  };

  for (const skill of provider.skills) {
    addItem("skill", {
      id: `skill:${skill.name}`,
      name: formatProviderSkillDisplayName(skill),
      ...(skill.shortDescription || skill.description
        ? { description: skill.shortDescription ?? skill.description }
        : {}),
      source:
        skill.source?.label ??
        formatProviderSkillInstallSource(skill) ??
        `${providerLabel} runtime`,
      state:
        skill.state ??
        (skill.enabled
          ? { status: "enabled" }
          : { status: "unavailable", reason: "This skill is disabled by the runtime." }),
    });
  }

  for (const command of provider.slashCommands) {
    addItem("slash-command", {
      id: `slash-command:${command.name}`,
      name: `/${command.name}`,
      ...(command.description || command.input?.hint
        ? { description: command.description ?? command.input?.hint }
        : {}),
      source: command.source?.label ?? `${providerLabel} runtime`,
      state: command.state ?? { status: "enabled" },
    });
  }

  for (const capability of provider.reportedCapabilities ?? []) {
    addItem(capability.kind, {
      id: capability.id,
      name: capability.name,
      ...(capability.description ? { description: capability.description } : {}),
      source: capability.source.label,
      state: capability.state,
    });
  }

  const knownKinds = new Set<string>(KNOWN_CAPABILITY_GROUPS.map((group) => group.kind));
  const additionalKinds = new Set<string>();
  for (const kind of reportedKinds) {
    if (!knownKinds.has(kind)) additionalKinds.add(kind);
  }
  for (const kind of itemsByKind.keys()) {
    if (!knownKinds.has(kind)) additionalKinds.add(kind);
  }

  return [
    ...KNOWN_CAPABILITY_GROUPS,
    ...[...additionalKinds]
      .sort((left, right) => left.localeCompare(right))
      .map((kind) => ({ kind, label: titleCaseKind(kind) })),
  ].map(({ kind, label }) => {
    const items = (itemsByKind.get(kind) ?? []).toSorted((left, right) =>
      left.name.localeCompare(right.name),
    );
    return {
      kind,
      label,
      reported: reportedKinds.has(kind) || items.length > 0,
      items,
    };
  });
}
