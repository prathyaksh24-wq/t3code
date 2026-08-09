export const PROVIDER_QUALIFICATION_AREAS = [
  "installation",
  "authentication",
  "models",
  "newSession",
  "resumedSession",
  "streaming",
  "toolsAndChanges",
  "permissions",
  "cancellation",
  "failure",
  "cleanup",
] as const;

export type ProviderQualificationArea = (typeof PROVIDER_QUALIFICATION_AREAS)[number];

export interface AutomatedQualification {
  readonly status: "automated";
  readonly evidence: ReadonlyArray<string>;
}

export interface QualificationException {
  readonly status: "exception";
  readonly reason: string;
  readonly mitigation: string;
  readonly evidence: ReadonlyArray<string>;
}

export type QualificationResult = AutomatedQualification | QualificationException;

export interface ProviderBetaQualification {
  readonly id: "codex" | "claude" | "cursor" | "grok" | "opencode";
  readonly label: string;
  readonly areas: Readonly<Record<ProviderQualificationArea, QualificationResult>>;
}

const automated = (...evidence: ReadonlyArray<string>): AutomatedQualification => ({
  status: "automated",
  evidence,
});

const localCredentialException = (
  providerGuide: string,
  providerLabel: string,
): QualificationException => ({
  status: "exception",
  reason: `${providerLabel} installation and authentication belong to the beta user's local runtime and subscription, so CI cannot exercise them without copying credentials or spending provider credits.`,
  mitigation:
    "Run the release checklist on each beta machine. Provider Settings must report the runtime as installed and authenticated before that runtime is enabled for a tester.",
  evidence: [providerGuide, "docs/releases/small-beta.md"],
});

const modelInventoryException = (
  providerGuide: string,
  providerTest: string,
  providerLabel: string,
): QualificationException => ({
  status: "exception",
  reason: `${providerLabel} model availability is account-specific and can change without a T3 Code release.`,
  mitigation:
    "Use the models returned by the runtime status probe and complete one new-session smoke with the selected beta model before rollout.",
  evidence: [providerGuide, providerTest, "docs/releases/small-beta.md"],
});

const commonContractEvidence = [
  "packages/contracts/src/provider.test.ts",
  "apps/server/integration/providerService.integration.test.ts",
  "apps/server/integration/orchestrationEngine.integration.test.ts",
] as const;

const makeAreas = (input: {
  readonly label: string;
  readonly guide: string;
  readonly adapterTest: string;
  readonly providerTest: string;
}): ProviderBetaQualification["areas"] => ({
  installation: localCredentialException(input.guide, input.label),
  authentication: localCredentialException(input.guide, input.label),
  models: modelInventoryException(input.guide, input.providerTest, input.label),
  newSession: automated(input.adapterTest, ...commonContractEvidence),
  resumedSession: automated(input.adapterTest, input.providerTest),
  streaming: automated(input.adapterTest, ...commonContractEvidence),
  toolsAndChanges: automated(input.adapterTest, ...commonContractEvidence),
  permissions: automated(
    input.adapterTest,
    "apps/server/src/orchestration/Layers/ProviderCommandReactor.test.ts",
  ),
  cancellation: automated(
    input.adapterTest,
    "apps/server/src/orchestration/Layers/ProviderRuntimeIngestion.test.ts",
  ),
  failure: automated(input.adapterTest, ...commonContractEvidence),
  cleanup: automated(
    input.adapterTest,
    "apps/server/src/provider/Layers/ProviderSessionReaper.test.ts",
    "apps/server/src/orchestration/Layers/ThreadDeletionReactor.test.ts",
  ),
});

export const PROVIDER_BETA_QUALIFICATIONS: ReadonlyArray<ProviderBetaQualification> = [
  {
    id: "codex",
    label: "Codex",
    areas: makeAreas({
      label: "Codex",
      guide: "docs/providers/codex.md",
      adapterTest: "apps/server/src/provider/Layers/CodexAdapter.test.ts",
      providerTest: "apps/server/src/provider/Layers/CodexProvider.test.ts",
    }),
  },
  {
    id: "claude",
    label: "Claude Code",
    areas: makeAreas({
      label: "Claude Code",
      guide: "docs/providers/claude.md",
      adapterTest: "apps/server/src/provider/Layers/ClaudeAdapter.test.ts",
      providerTest: "apps/server/src/provider/Layers/ClaudeCapabilitiesProbe.test.ts",
    }),
  },
  {
    id: "cursor",
    label: "Cursor",
    areas: makeAreas({
      label: "Cursor",
      guide: "docs/releases/provider-qualification.md",
      adapterTest: "apps/server/src/provider/Layers/CursorAdapter.test.ts",
      providerTest: "apps/server/src/provider/Layers/CursorProvider.test.ts",
    }),
  },
  {
    id: "grok",
    label: "Grok Build",
    areas: makeAreas({
      label: "Grok Build",
      guide: "docs/releases/provider-qualification.md",
      adapterTest: "apps/server/src/provider/Layers/GrokAdapter.test.ts",
      providerTest: "apps/server/src/provider/Layers/GrokProvider.test.ts",
    }),
  },
  {
    id: "opencode",
    label: "OpenCode",
    areas: makeAreas({
      label: "OpenCode",
      guide: "docs/releases/provider-qualification.md",
      adapterTest: "apps/server/src/provider/Layers/OpenCodeAdapter.test.ts",
      providerTest: "apps/server/src/provider/Layers/OpenCodeProvider.test.ts",
    }),
  },
];
