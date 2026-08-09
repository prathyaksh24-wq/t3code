import { assert, it } from "@effect/vitest";

import {
  applyPreferredCodexDefaultModel,
  mapCodexModelCapabilities,
  parseCodexMcpCapabilities,
  parseCodexPluginCapabilities,
} from "./CodexProvider.ts";

it("maps current Codex model capability fields", () => {
  const capabilities = mapCodexModelCapabilities({
    additionalSpeedTiers: [],
    defaultReasoningEffort: "super-high",
    description: "Test model",
    displayName: "GPT Test",
    hidden: false,
    id: "gpt-test",
    isDefault: true,
    model: "gpt-test",
    defaultServiceTier: "flex",
    serviceTiers: [
      {
        id: "priority",
        name: "Fast",
        description: "Lower latency responses.",
      },
      {
        id: "flex",
        name: "Flex",
        description: "Lower-cost asynchronous routing.",
      },
    ],
    supportedReasoningEfforts: [
      {
        description: "Maximum reasoning",
        reasoningEffort: "super-high",
      },
    ],
  });

  assert.deepStrictEqual(capabilities.optionDescriptors, [
    {
      id: "reasoningEffort",
      label: "Reasoning",
      type: "select",
      options: [{ id: "super-high", label: "super-high", isDefault: true }],
      currentValue: "super-high",
    },
    {
      id: "serviceTier",
      label: "Service Tier",
      type: "select",
      options: [
        { id: "default", label: "Standard" },
        {
          id: "priority",
          label: "Fast",
          description: "Lower latency responses.",
        },
        {
          id: "flex",
          label: "Flex",
          description: "Lower-cost asynchronous routing.",
          isDefault: true,
        },
      ],
      currentValue: "flex",
    },
  ]);
});

it("uses standard routing when the catalog has no default service tier", () => {
  const capabilities = mapCodexModelCapabilities({
    additionalSpeedTiers: ["fast"],
    defaultReasoningEffort: "medium",
    defaultServiceTier: null,
    description: "Test model",
    displayName: "GPT Test",
    hidden: false,
    id: "gpt-test",
    isDefault: true,
    model: "gpt-test",
    serviceTiers: [
      {
        id: "priority",
        name: "Fast",
        description: "1.5x speed, increased usage",
      },
    ],
    supportedReasoningEfforts: [],
  });

  assert.deepStrictEqual(capabilities.optionDescriptors, [
    {
      id: "serviceTier",
      label: "Service Tier",
      type: "select",
      options: [
        { id: "default", label: "Standard", isDefault: true },
        {
          id: "priority",
          label: "Fast",
          description: "1.5x speed, increased usage",
        },
      ],
      currentValue: "default",
    },
  ]);
});

it("marks the most preferred available model as default", () => {
  const models = applyPreferredCodexDefaultModel([
    { slug: "gpt-5.6-terra", name: "GPT-5.6-Terra", isCustom: false, capabilities: null },
    { slug: "gpt-5.4", name: "GPT-5.4", isCustom: false, isDefault: true, capabilities: null },
  ]);

  assert.deepStrictEqual(
    models.map((model) => ({ slug: model.slug, isDefault: model.isDefault })),
    [
      { slug: "gpt-5.6-terra", isDefault: true },
      { slug: "gpt-5.4", isDefault: undefined },
    ],
  );
});

it("prefers sol over terra when both are available", () => {
  const models = applyPreferredCodexDefaultModel([
    { slug: "gpt-5.6-terra", name: "GPT-5.6-Terra", isCustom: false, capabilities: null },
    { slug: "gpt-5.6-sol", name: "GPT-5.6-Sol", isCustom: false, capabilities: null },
  ]);

  assert.deepStrictEqual(models.find((model) => model.isDefault)?.slug, "gpt-5.6-sol");
});

it("keeps Codex's own default when no preferred model is available", () => {
  const models = applyPreferredCodexDefaultModel([
    { slug: "gpt-5.5", name: "GPT-5.5", isCustom: false, capabilities: null },
    { slug: "gpt-5.4", name: "GPT-5.4", isCustom: false, isDefault: true, capabilities: null },
  ]);

  assert.deepStrictEqual(models.find((model) => model.isDefault)?.slug, "gpt-5.4");
});

it("ignores custom models that shadow a preferred slug", () => {
  const models = applyPreferredCodexDefaultModel([
    { slug: "gpt-5.6-sol", name: "gpt-5.6-sol", isCustom: true, capabilities: null },
    { slug: "gpt-5.4", name: "GPT-5.4", isCustom: false, isDefault: true, capabilities: null },
  ]);

  assert.deepStrictEqual(models.find((model) => model.isDefault)?.slug, "gpt-5.4");
});

it("maps Codex MCP authentication into inspectable capability state", () => {
  const capabilities = parseCodexMcpCapabilities({
    data: [
      {
        authStatus: "notLoggedIn",
        name: "github",
        resourceTemplates: [],
        resources: [],
        serverInfo: {
          name: "github",
          title: "GitHub",
          version: "1.0.0",
          description: "Repository tools",
        },
        tools: {
          search: { name: "search", description: "Search repositories", inputSchema: {} },
        },
      },
    ],
  });

  assert.deepStrictEqual(capabilities, [
    {
      id: "mcp-server:github",
      kind: "mcp-server",
      name: "GitHub",
      description: "Repository tools · 1 tools · 0 resources · 0 resource templates",
      state: {
        status: "misconfigured",
        reason: "This MCP server requires authentication in Codex.",
      },
      source: { kind: "runtime-config", label: "Codex MCP configuration" },
    },
  ]);
});

it("preserves Codex administrator policy on installed plugins", () => {
  const capabilities = parseCodexPluginCapabilities({
    marketplaces: [
      {
        name: "openai-curated",
        interface: { displayName: "OpenAI Curated" },
        plugins: [
          {
            authPolicy: "ON_USE",
            availability: "DISABLED_BY_ADMIN",
            enabled: false,
            id: "github",
            installPolicy: "AVAILABLE",
            installed: true,
            name: "github",
            source: { type: "remote" },
          },
        ],
      },
    ],
  });

  assert.deepStrictEqual(capabilities[0], {
    id: "plugin:openai-curated:github",
    kind: "plugin",
    name: "github",
    state: {
      status: "permission-restricted",
      reason: "This plugin is disabled by Codex administrator policy.",
    },
    source: { kind: "remote", label: "OpenAI Curated" },
  });
});
