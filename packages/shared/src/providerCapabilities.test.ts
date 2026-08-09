import { describe, expect, it } from "vite-plus/test";

import { isProviderCapabilityInvokable } from "./providerCapabilities.ts";

describe("isProviderCapabilityInvokable", () => {
  it("preserves legacy enabled state when no runtime state is reported", () => {
    expect(isProviderCapabilityInvokable({})).toBe(true);
    expect(isProviderCapabilityInvokable({}, false)).toBe(false);
  });

  it.each(["unavailable", "misconfigured", "permission-restricted"] as const)(
    "blocks %s capabilities from invocation surfaces",
    (status) => {
      expect(
        isProviderCapabilityInvokable({
          state: { status, reason: "Not available for this runtime." },
        }),
      ).toBe(false);
    },
  );
});
