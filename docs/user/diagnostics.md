# Diagnostics and run safety

Open **Settings → General → Diagnostics** to inspect live provider processes,
resource history, and trace summaries.

The download button in **Trace Diagnostics** creates a redacted JSON support
file. It contains aggregate counts for traces, processes, sessions, pending
approvals, and active runs. It intentionally omits file paths, process
commands, trace IDs, causes, messages, provider arguments, and conversation
content.

Run guardrails are configured in **Settings → General → Run safety**:

- **Concurrent runs** limits how many provider turns can run at once.
- **Maximum run duration** stops a turn that exceeds the configured minutes.
- **Maximum tokens** stops a turn after its reported usage reaches the ceiling.
- **Approval timeout** cancels an unanswered approval after the configured minutes.

When a run is stopped by a guardrail, the thread records the reason and the
provider is interrupted. If interruption is unavailable, T3 attempts to stop
the provider session as a fallback.
