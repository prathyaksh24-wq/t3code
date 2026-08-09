import { describe, expect, it } from "@effect/vitest";

import {
  PROVIDER_BETA_QUALIFICATIONS,
  PROVIDER_QUALIFICATION_AREAS,
} from "./beta-provider-qualification.config.ts";
import {
  renderProviderQualificationSummary,
  validateProviderQualifications,
} from "./beta-provider-qualification.ts";

const repoRoot = new URL("..", import.meta.url).pathname.replace(/^\/(?=[A-Za-z]:)/, "");

describe("beta provider qualification", () => {
  it("covers every supported provider and required area with existing evidence", () => {
    expect(
      validateProviderQualifications({ repoRoot, qualifications: PROVIDER_BETA_QUALIFICATIONS }),
    ).toEqual([]);
    for (const provider of PROVIDER_BETA_QUALIFICATIONS) {
      expect(Object.keys(provider.areas).sort()).toEqual([...PROVIDER_QUALIFICATION_AREAS].sort());
    }
  });

  it("renders a release-review summary", () => {
    const summary = renderProviderQualificationSummary(PROVIDER_BETA_QUALIFICATIONS);
    expect(summary).toContain("| Codex |");
    expect(summary).toContain("| Claude Code |");
    expect(summary).toContain("| OpenCode |");
  });
});
