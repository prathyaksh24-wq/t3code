import { describe, expect, it } from "vite-plus/test";

import { resolveProviderRuntimeModes } from "./runtimeModeOptions";

describe("resolveProviderRuntimeModes", () => {
  it("uses the compatibility modes when the runtime has not reported capabilities", () => {
    expect(resolveProviderRuntimeModes(undefined)).toEqual([
      "approval-required",
      "auto-accept-edits",
      "auto",
      "full-access",
    ]);
  });

  it("preserves only the modes reported by the selected runtime", () => {
    expect(
      resolveProviderRuntimeModes({
        sessionResume: { support: "supported" },
        turnCancellation: { support: "supported" },
        conversationRollback: { support: "supported" },
        executionModes: ["approval-required", "full-access"],
      }),
    ).toEqual(["approval-required", "full-access"]);
  });

  it("does not invent an access mode when the runtime explicitly reports none", () => {
    expect(
      resolveProviderRuntimeModes({
        sessionResume: { support: "supported" },
        turnCancellation: { support: "supported" },
        conversationRollback: { support: "supported" },
        executionModes: [],
      }),
    ).toEqual([]);
  });
});
