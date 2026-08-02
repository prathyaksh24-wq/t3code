# Runtime modes

T3 Code has a global runtime mode switch in the chat toolbar:

- **Full access** (default): starts sessions with `approvalPolicy: never` and `sandboxMode: danger-full-access`.
- **Supervised**: starts sessions with `approvalPolicy: on-request` and `sandboxMode: workspace-write`, then prompts in-app for command/file approvals.

The toolbar is capability-driven per provider instance. The selected adapter
reports its supported `executionModes`; only those modes appear in the picker.
This keeps runtime, account, model, and access policy as separate selections and
allows a future adapter to expose a smaller or different safe set without
changing the session interface.
