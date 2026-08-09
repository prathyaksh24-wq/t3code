import type { ServerProvider, ServerProviderCapabilityState } from "@t3tools/contracts";

import { Badge } from "../ui/badge";
import { buildProviderCapabilityInventory } from "./providerCapabilityInventory.logic";

function statePresentation(state: ServerProviderCapabilityState) {
  switch (state.status) {
    case "enabled":
      return { label: "Enabled", variant: "success" as const };
    case "unavailable":
      return { label: "Unavailable", variant: "secondary" as const };
    case "misconfigured":
      return { label: "Needs setup", variant: "error" as const };
    case "permission-restricted":
      return { label: "Restricted", variant: "warning" as const };
  }
}

export function ProviderCapabilityInventory(props: { readonly provider: ServerProvider }) {
  const groups = buildProviderCapabilityInventory(props.provider);

  return (
    <section
      className="grid gap-2 border-t border-border/60 pt-3"
      aria-label="Runtime capabilities"
    >
      <div className="grid gap-0.5">
        <span className="text-xs font-semibold text-foreground">Runtime capabilities</span>
        <p className="text-xs text-muted-foreground">
          Read-only inventory reported by this runtime. Manage configuration in the runtime itself.
        </p>
      </div>

      <div className="grid gap-2 lg:grid-cols-2">
        {groups.map((group) => (
          <div
            key={group.kind}
            className="rounded-md border border-border/60 bg-background/50 p-2.5"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-medium text-foreground">{group.label}</span>
              {group.reported ? (
                <span className="text-[11px] tabular-nums text-muted-foreground">
                  {group.items.length}
                </span>
              ) : null}
            </div>

            {group.items.length > 0 ? (
              <div className="mt-2 grid gap-2">
                {group.items.map((item) => {
                  const state = statePresentation(item.state);
                  return (
                    <div
                      key={item.id}
                      className="grid gap-1 border-t border-border/50 pt-2 first:border-0 first:pt-0"
                    >
                      <div className="flex min-w-0 items-center justify-between gap-2">
                        <span className="truncate text-xs text-foreground">{item.name}</span>
                        <Badge variant={state.variant} size="sm">
                          {state.label}
                        </Badge>
                      </div>
                      <span className="truncate text-[11px] text-muted-foreground">
                        {item.source}
                      </span>
                      {item.description ? (
                        <p className="text-[11px] leading-4 text-muted-foreground">
                          {item.description}
                        </p>
                      ) : null}
                      {item.state.status !== "enabled" ? (
                        <p className="text-[11px] leading-4 text-muted-foreground">
                          {item.state.reason}
                        </p>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="mt-1.5 text-[11px] text-muted-foreground">
                {group.reported
                  ? `No ${group.label.toLowerCase()} reported.`
                  : "Not reported by runtime."}
              </p>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
