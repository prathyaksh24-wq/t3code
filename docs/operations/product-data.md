# Product data ownership

T3 Code stores each environment's managed data beneath one configurable product data root. The
root is selected with `--base-dir` or `T3CODE_HOME`. Existing installs keep their current default
root and directory names.

## Ownership scope

Each root contains `data-scope.json`, a versioned manifest that associates every database record
and managed artifact below that root with one owner and one workspace:

```json
{
  "version": 1,
  "ownerId": "local",
  "workspaceId": "default"
}
```

`T3CODE_OWNER_ID` and `T3CODE_WORKSPACE_ID` override the single-user defaults. IDs may contain
letters, numbers, periods, underscores, and hyphens. T3 Code refuses to start when the configured
scope does not match an existing manifest, so a root cannot be silently reassigned.

This is root-level isolation, not shared-root multi-tenancy. Run each beta user or isolated
workspace with a separate explicit product data root. A project is still an environment-local
record that can point at any repository on disk; repositories do not need to live inside the
managed `projects` directory.

## Directory layout

```text
<product-data-root>/
|-- data-scope.json
|-- userdata/
|   |-- state.sqlite
|   |-- attachments/
|   |-- logs/
|   `-- secrets/
|-- caches/
|-- worktrees/
|-- runtime-homes/
|-- projects/
`-- backups/
```

- `userdata` remains the canonical persistent state location. An implicit development root uses
  `dev` for state, preserving the existing isolated development behavior.
- `caches` contains rebuildable provider status data.
- `worktrees` keeps agent-created Git worktrees.
- `runtime-homes` is reserved for provider homes managed by T3 Code. Existing provider login
  directories remain external unless a provider is explicitly configured to use a managed home.
- `projects` is reserved for repositories cloned or created by T3 Code.
- `backups` is reserved for product-managed backups.

On upgrade, T3 Code creates the manifest and missing managed directories without moving
`userdata`, `caches`, or `worktrees`.

## Logging privacy

Server logs and traces should contain operational metadata, not credentials or conversation
content. Raw and normalized provider event streams can contain prompts, responses, tool inputs,
and tool output, so they are disabled by default. Set `T3CODE_LOG_PROVIDER_EVENTS=true` only for a
short, deliberate diagnostic session and treat the resulting files as sensitive.

WebSocket event logging remains controlled separately by `T3CODE_LOG_WS_EVENTS`.

## Retention and cleanup

- Server traces and provider event logs use bounded rotating files. Current defaults retain up to
  10 files of 10 MiB for the trace and each provider-thread log.
- Provider status caches are rebuildable. Remove them only while the server is stopped.
- Worktrees are retained until the user explicitly removes them. Automatic deletion is unsafe
  because a worktree can contain uncommitted code.
- Interrupted session records remain in `state.sqlite`; provider processes are stopped by the
  runtime lifecycle, while durable history remains available for recovery and audit.
- Backups are retained until explicit removal.

Automated age-based cleanup and per-root disk quotas are not implemented yet. Add those controls
before using a product data root as a shared hosted service.
