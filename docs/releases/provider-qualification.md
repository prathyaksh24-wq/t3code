# Provider qualification for the small beta

The small beta supports Codex, Claude Code, Cursor, Grok Build, and OpenCode through their existing
T3 provider adapters. Qualification keeps runtime-owned behavior at the adapter boundary; it does
not copy credentials, model catalogs, skills, commands, plugins, or MCP configuration between
runtimes.

Run the machine-checked coverage gate from the repository root:

```bash
vp run beta:qualify
```

The gate requires every supported runtime to account for installation, authentication, model
discovery, new and resumed sessions, streaming, tools and changes, permissions, cancellation,
failure, and cleanup. Automated entries must point to test evidence that exists in the checkout.
Exceptions must state both why automation is unsafe or unreliable and how a beta operator closes
the gap.

## Current qualification boundary

| Runtime     | Automated contract and adapter coverage                                                                                          | Live beta exception                                                                                      |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Codex       | Sessions, resume, streaming, tools and changes, permissions, cancellation, failure, cleanup, and capability inventory            | Installation, subscription authentication, and account-specific models are checked on each beta machine. |
| Claude Code | Sessions, resume, streaming, tools and changes, permissions, cancellation, failure, cleanup, skills, and initialization commands | Installation, subscription authentication, and account-specific models are checked on each beta machine. |
| Cursor      | Sessions, resume behavior, ACP streaming, tools and changes, permissions, cancellation, failure, and cleanup                     | Installation, authentication, and model inventory remain a per-machine smoke check.                      |
| Grok Build  | ACP sessions, streaming, tools and changes, permissions, cancellation, failure, and cleanup                                      | Installation, authentication, and model inventory remain a per-machine smoke check.                      |
| OpenCode    | Sessions, streaming, tools and changes, permissions, cancellation, failure, cleanup, and local secret handling                   | Installation, authentication, and model inventory remain a per-machine smoke check.                      |

The detailed evidence map lives in `scripts/beta-provider-qualification.config.ts`. A provider is not
beta-ready merely because its binary exists. Provider Settings must report it as installed and
authenticated, its model picker must contain the intended model, and the operator must complete the
live checklist below.

## Per-machine live checklist

For each runtime enabled for a tester:

1. Install the provider through its own supported installation path and authenticate in that
   runtime. Do not paste provider credentials into T3 settings unless that adapter explicitly owns a
   secret-backed field.
2. Refresh Provider Settings and confirm installation, account state, model inventory, execution
   modes, and capability inventory are truthful.
3. Create a disposable project thread, send one turn, and confirm incremental assistant output.
4. Run one harmless read tool and one reversible file edit, inspect the diff, then restore or commit
   it.
5. Exercise an approval or user-input request when supported.
6. Cancel an active turn and confirm no later provider events mutate the stopped turn.
7. Resume the thread when the adapter reports resume support. When resume is unsupported, confirm
   the UI says so and a new provider session starts without losing T3 thread history.
8. Trigger a safe failure, such as an invalid model selection, and confirm the error remains visible
   with a retry path.
9. Close the session and confirm the provider process, terminal, and workspace lease are released.

Record the runtime version, selected model, operating system, date, result, and any exception in the
beta release notes. Never store tokens, pairing URLs, prompts, tool output, or private paths in the
qualification record.
