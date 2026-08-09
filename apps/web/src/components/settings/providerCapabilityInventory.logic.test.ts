import { ProviderDriverKind, ProviderInstanceId, type ServerProvider } from "@t3tools/contracts";
import { describe, expect, it } from "vite-plus/test";

import { buildProviderCapabilityInventory } from "./providerCapabilityInventory.logic";

const provider: ServerProvider = {
  instanceId: ProviderInstanceId.make("codex"),
  driver: ProviderDriverKind.make("codex"),
  displayName: "Codex",
  enabled: true,
  installed: true,
  version: "1.0.0",
  status: "ready",
  auth: { status: "authenticated" },
  checkedAt: "2026-08-09T00:00:00.000Z",
  models: [],
  slashCommands: [],
  skills: [
    {
      name: "review",
      displayName: "Code Review",
      path: "/skills/review/SKILL.md",
      scope: "user",
      enabled: false,
      state: { status: "unavailable", reason: "Disabled in Codex." },
      source: { kind: "user", label: "Codex user skills" },
    },
  ],
  reportedCapabilityKinds: ["skill", "mcp-server", "future-kind"],
  reportedCapabilities: [
    {
      id: "mcp-server:github",
      kind: "mcp-server",
      name: "GitHub",
      state: {
        status: "misconfigured",
        reason: "Authentication required.",
      },
      source: { kind: "runtime-config", label: "Codex MCP configuration" },
    },
  ],
};

describe("buildProviderCapabilityInventory", () => {
  it("keeps runtime source and availability state grouped by capability kind", () => {
    const groups = buildProviderCapabilityInventory(provider);

    expect(groups.find((group) => group.kind === "skill")?.items[0]).toMatchObject({
      name: "Code Review",
      source: "Codex user skills",
      state: { status: "unavailable", reason: "Disabled in Codex." },
    });
    expect(groups.find((group) => group.kind === "mcp-server")?.items[0]).toMatchObject({
      name: "GitHub",
      source: "Codex MCP configuration",
      state: { status: "misconfigured", reason: "Authentication required." },
    });
  });

  it("distinguishes an empty runtime report from a capability the runtime did not report", () => {
    const groups = buildProviderCapabilityInventory(provider);

    expect(groups.find((group) => group.kind === "mcp-server")?.reported).toBe(true);
    expect(groups.find((group) => group.kind === "plugin")?.reported).toBe(false);
    expect(groups.find((group) => group.kind === "future-kind")).toMatchObject({
      label: "Future Kind",
      reported: true,
      items: [],
    });
  });
});
