import {
  DEFAULT_PROVIDER_RUNTIME_MODES,
  type RuntimeMode,
  type ServerProvider,
} from "@t3tools/contracts";
import { LockIcon, LockOpenIcon, PenLineIcon, SparklesIcon, type LucideIcon } from "lucide-react";

export interface RuntimeModeOption {
  readonly value: RuntimeMode;
  readonly label: string;
  readonly description: string;
  readonly icon: LucideIcon;
}

export const RUNTIME_MODE_OPTIONS: ReadonlyArray<RuntimeModeOption> = [
  {
    value: "approval-required",
    label: "Supervised",
    description: "Ask before commands and file changes.",
    icon: LockIcon,
  },
  {
    value: "auto-accept-edits",
    label: "Auto-accept edits",
    description: "Auto-approve edits, ask before other actions.",
    icon: PenLineIcon,
  },
  {
    value: "auto",
    label: "Auto",
    description: "An AI reviewer approves routine actions; risky ones still ask.",
    icon: SparklesIcon,
  },
  {
    value: "full-access",
    label: "Full access",
    description: "Allow commands and edits without prompts.",
    icon: LockOpenIcon,
  },
];

const runtimeModeOptionByValue = new Map(
  RUNTIME_MODE_OPTIONS.map((option) => [option.value, option] as const),
);

/**
 * Resolve the modes a provider instance can safely expose in the composer.
 * Older snapshots do not carry runtime capabilities, so they use the
 * compatibility set until the next provider probe arrives. A reported empty
 * list is preserved: it means the runtime explicitly exposed no modes.
 */
export function resolveProviderRuntimeModes(
  capabilities: ServerProvider["runtimeCapabilities"] | undefined,
): ReadonlyArray<RuntimeMode> {
  if (capabilities === undefined) {
    return [...DEFAULT_PROVIDER_RUNTIME_MODES];
  }
  return capabilities.executionModes.filter((mode) => runtimeModeOptionByValue.has(mode));
}

export function getRuntimeModeOption(mode: RuntimeMode): RuntimeModeOption | undefined {
  return runtimeModeOptionByValue.get(mode);
}
