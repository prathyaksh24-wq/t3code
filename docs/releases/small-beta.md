# Small beta operations

This runbook is for one to three trusted users running the fork on machines they control. It is a
local-first beta, not a hosted multi-tenant service.

## Setup

1. Give each tester a separate product data root. Start T3 with `--base-dir <path>` or set
   `T3CODE_HOME`; do not share one root between users or workspaces.
2. Install and authenticate only the provider runtimes that tester will use.
3. Open Provider Settings and disable runtimes that have not passed the per-machine checklist in
   [Provider qualification](./provider-qualification.md).
4. Keep provider event logging off. Enable `T3CODE_LOG_PROVIDER_EVENTS` only for a short diagnostic
   session and treat the resulting files as conversation content.
5. Configure Run safety limits before concurrent work: concurrent runs, maximum duration, maximum
   tokens, and approval timeout.

## Build and distribution

Run **Fork Beta Artifact** from GitHub Actions with an explicit commit, branch, or tag. The workflow
qualifies the selected source, runs checks and tests, builds the production desktop pipeline, runs
release smoke, and then creates an unsigned Windows x64 installer. It uploads the installer as a
14-day workflow artifact; it does not publish a GitHub release, npm package, hosted web app, relay,
or mobile build and uses no upstream-owned production service.

The Windows artifact is unsigned until the fork owns and configures signing credentials. Share it
only with the named beta testers and provide its exact commit SHA and checksum alongside the file.

Run **Beta Web Captures** against the same commit before distribution. It creates a seeded,
credential-free environment and captures the landing page, active chat, streaming, permission,
settings, terminal, diff, sidebar, and responsive states. The run also fails when idle or streaming
median main-thread work exceeds its development-mode budget (1,000 ms idle or 1,200 ms streaming
across three four-second samples), when a continuous animation repaints layout or paint
properties, or when the browser reports an actionable error. Review the uploaded screenshots and
`report.json`; passing automation does not replace a human visual comparison.

## Upgrade

1. Stop active turns and close T3 before replacing the build.
2. Copy the product data root to a separate backup location while the server is stopped. Include
   `data-scope.json` and `userdata/state.sqlite` with any SQLite `-wal` and `-shm` siblings.
3. Record the current build SHA and installer so rollback remains possible.
4. Install the new artifact, start it against the same product data root, and verify the data-scope
   owner/workspace IDs before sending a turn.
5. Repeat the enabled-provider smoke checks and inspect one existing thread, terminal, and diff.

## Rollback

1. Stop T3. Never restore a database or worktree while the server is running.
2. Reinstall the previous recorded artifact.
3. If the new build migrated or changed persistent state incompatibly, move the failed root aside
   and restore the complete pre-upgrade copy. Do not mix a restored SQLite database with newer WAL or
   SHM files.
4. Start the previous build and verify threads, provider settings, and worktree paths before resuming
   work.

## Data, retention, and recovery

- The product data layout and ownership manifest are documented in
  [Product data ownership](../operations/product-data.md).
- Provider sessions, terminals, pending approvals, worktree leases, and interrupted turns are
  recovered or cleaned through their existing runtime lifecycle and reaper paths. Durable thread
  history remains in SQLite for inspection.
- Worktrees and backups are never removed automatically because they can contain uncommitted or
  user-owned data. Review them manually with Git status before removal.
- Logs are bounded and provider event logging is off by default. The diagnostics export contains
  aggregate, redacted operational data rather than prompts, commands, paths, or credentials.

## Known limitations

- There is no automatic age-based worktree/backup cleanup or per-root disk quota. Check free disk
  space before upgrades and long multi-agent runs. This is acceptable only for the named local beta
  users; it blocks a shared hosted deployment.
- Live installation, authentication, and model availability cannot run in CI because those checks
  use each tester's subscriptions and local credentials.
- Codex and Claude expose richer capability inventory than runtimes that do not report the same
  metadata. Missing inventory is shown as not reported, not inferred.
- Provider conversation state cannot be transplanted between runtimes. T3 preserves its own thread
  and workspace history, while a provider without native resume starts a new provider session.
- The beta workflow currently produces only an unsigned Windows x64 desktop installer. Other
  release surfaces remain disabled until the fork owns their accounts, credentials, and rollback
  paths.

## Support bundle

Use **Settings → General → Diagnostics** to inspect runtime health and download the redacted support
file. Attach that file, the build SHA, operating system, provider/runtime version, and reproduction
steps to a private beta report. Do not attach provider logs unless the reporter has reviewed and
redacted their content.
