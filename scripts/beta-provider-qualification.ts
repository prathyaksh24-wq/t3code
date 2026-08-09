// @effect-diagnostics nodeBuiltinImport:off
import * as NodeFS from "node:fs";
import * as NodePath from "node:path";
import * as NodeURL from "node:url";

import {
  PROVIDER_BETA_QUALIFICATIONS,
  PROVIDER_QUALIFICATION_AREAS,
  type ProviderBetaQualification,
} from "./beta-provider-qualification.config.ts";

const expectedProviderIds = ["claude", "codex", "cursor", "grok", "opencode"] as const;

export function validateProviderQualifications(input: {
  readonly repoRoot: string;
  readonly qualifications: ReadonlyArray<ProviderBetaQualification>;
}): ReadonlyArray<string> {
  const errors: string[] = [];
  const providerIds = input.qualifications.map((provider) => provider.id).sort();

  if (new Set(providerIds).size !== providerIds.length) {
    errors.push("Provider qualification ids must be unique.");
  }
  if (providerIds.join(",") !== expectedProviderIds.join(",")) {
    errors.push(`Provider qualifications must cover: ${expectedProviderIds.join(", ")}.`);
  }

  for (const provider of input.qualifications) {
    for (const area of PROVIDER_QUALIFICATION_AREAS) {
      const result = provider.areas[area];
      if (!result) {
        errors.push(`${provider.id}.${area} is missing.`);
        continue;
      }
      if (result.evidence.length === 0) {
        errors.push(`${provider.id}.${area} must include evidence.`);
      }
      for (const evidence of result.evidence) {
        if (!NodeFS.existsSync(NodePath.resolve(input.repoRoot, evidence))) {
          errors.push(`${provider.id}.${area} references missing evidence: ${evidence}.`);
        }
      }
      if (result.status === "exception") {
        if (result.reason.trim().length === 0) {
          errors.push(`${provider.id}.${area} exception must explain the reason.`);
        }
        if (result.mitigation.trim().length === 0) {
          errors.push(`${provider.id}.${area} exception must include a mitigation.`);
        }
      }
    }
  }

  return errors;
}

export function renderProviderQualificationSummary(
  qualifications: ReadonlyArray<ProviderBetaQualification>,
): string {
  const rows = qualifications.map((provider) => {
    const automated = Object.values(provider.areas).filter(
      (result) => result.status === "automated",
    ).length;
    const exceptions = PROVIDER_QUALIFICATION_AREAS.length - automated;
    return `| ${provider.label} | ${String(automated)} | ${String(exceptions)} |`;
  });

  return [
    "| Runtime | Automated areas | Documented exceptions |",
    "| --- | ---: | ---: |",
    ...rows,
  ].join("\n");
}

const scriptPath = NodeURL.fileURLToPath(import.meta.url);
const isEntrypoint =
  process.argv[1] && NodePath.resolve(process.argv[1]) === NodePath.resolve(scriptPath);

if (isEntrypoint) {
  const repoRoot = NodePath.resolve(NodePath.dirname(scriptPath), "..");
  const errors = validateProviderQualifications({
    repoRoot,
    qualifications: PROVIDER_BETA_QUALIFICATIONS,
  });
  if (errors.length > 0) {
    for (const error of errors) process.stderr.write(`- ${error}\n`);
    process.exitCode = 1;
  } else {
    process.stdout.write(`${renderProviderQualificationSummary(PROVIDER_BETA_QUALIFICATIONS)}\n`);
  }
}
