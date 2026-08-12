# Standalone foundation beta notes

This milestone turns the T3 Code fork into a separate local-first coding workspace for one to three
trusted users. It remains a downstream fork: T3 Code owns the inherited application foundation,
while this repository owns its product data boundary, interface changes, beta operations, and
release decisions. It does not share Vellum application data or configuration.

## What is available

- General coding chats can start without a project and move into a project before or between idle
  turns.
- Codex, Claude Code, Cursor, Grok Build, and OpenCode remain provider runtimes behind the existing
  typed adapter boundary.
- Runtime, account, model, execution mode, connection state, and runtime-owned capabilities are
  presented as separate concepts.
- Chat output streams in event order, with typed tool, permission, file-change, cancellation,
  failure, and resume states.
- Run limits, queued approvals, redacted diagnostics, terminal, diff, branch, worktree, and
  one-writer workspace controls are available in the shared application surface.
- Fork-owned workflows qualify provider coverage, build an unsigned Windows x64 artifact, and
  capture seeded browser states with performance and animation checks.

## Operating boundary

- Each beta user uses a separate product data root and authenticates through the provider runtime's
  supported subscription, API, or local configuration path.
- The fork does not transplant provider sessions, credentials, skills, MCP configuration, or model
  catalogs between runtimes.
- Provider installation, authentication, and account-specific models require the per-machine
  checklist because CI has no beta-user credentials.
- The desktop artifact is unsigned and retained as a workflow artifact rather than published as a
  public release.
- Worktree and backup cleanup remains deliberate and manual. Automatic age-based cleanup and disk
  quotas are required before a shared or hosted deployment.

## Verification

- Pull-request CI covers formatting, lint, type checks, tests, desktop build output, mobile static
  analysis, and release smoke behavior.
- The provider qualification gate maps every supported runtime to automated evidence or a named
  live exception.
- The seeded browser workflow captures landing, active chat, streaming, permission, settings,
  terminal, diff, sidebar, and responsive states and rejects browser errors or continuous
  paint/layout animation.

See [Small beta operations](./small-beta.md) for setup, upgrade, rollback, retention, recovery, and
support steps. See [Provider qualification](./provider-qualification.md) before enabling a runtime
for a tester.
