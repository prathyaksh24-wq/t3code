import type { ProviderRuntimeCapability, ServerProvider } from "@t3tools/contracts";
import {
  CircleAlertIcon,
  CheckCircle2Icon,
  KeyRoundIcon,
  RefreshCwIcon,
  type LucideIcon,
} from "lucide-react";

import { getRuntimeModeOption } from "../chat/runtimeModeOptions";
import { cn } from "../../lib/utils";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { RedactedSensitiveText } from "./RedactedSensitiveText";
import { getProviderSummary, type ProviderStatusKey } from "./providerStatus";

function capabilityLabel(capability: ProviderRuntimeCapability): string {
  return capability.support === "supported" ? "Supported" : "Not supported";
}

function capabilityVariant(capability: ProviderRuntimeCapability) {
  return capability.support === "supported" ? ("success" as const) : ("secondary" as const);
}

function actionCopy(provider: ServerProvider | undefined): {
  readonly title: string;
  readonly detail: string;
  readonly icon: LucideIcon;
  readonly tone: string;
} {
  if (!provider) {
    return {
      title: "Runtime status is not available",
      detail: "Refresh the provider list to check installation and authentication.",
      icon: CircleAlertIcon,
      tone: "border-border/70 bg-muted/20 text-muted-foreground",
    };
  }
  if (!provider.enabled) {
    return {
      title: "Runtime is disabled",
      detail: "Enable this runtime below before selecting it for new sessions.",
      icon: CircleAlertIcon,
      tone: "border-warning/30 bg-warning/8 text-warning-foreground",
    };
  }
  if (!provider.installed) {
    return {
      title: "Runtime is not installed",
      detail: "Install the runtime or set its executable path below, then refresh status.",
      icon: CircleAlertIcon,
      tone: "border-warning/30 bg-warning/8 text-warning-foreground",
    };
  }
  if (provider.auth.status !== "authenticated") {
    return {
      title: "Authentication needs attention",
      detail:
        "Sign in with the runtime's supported CLI flow or configure a supported credential below, then refresh status.",
      icon: KeyRoundIcon,
      tone: "border-warning/30 bg-warning/8 text-warning-foreground",
    };
  }
  if (provider.status === "error" || provider.status === "warning") {
    return {
      title: "Runtime needs attention",
      detail: provider.message ?? "Review the runtime settings below, then refresh status.",
      icon: CircleAlertIcon,
      tone: "border-warning/30 bg-warning/8 text-warning-foreground",
    };
  }
  return {
    title: "Runtime is ready",
    detail: "This runtime can be selected for new sessions.",
    icon: CheckCircle2Icon,
    tone: "border-success/30 bg-success/8 text-success-foreground",
  };
}

export function ProviderRuntimeStatus(props: {
  readonly instanceId: string;
  readonly provider: ServerProvider | undefined;
  readonly onRefresh: () => void;
  readonly isRefreshing: boolean;
}) {
  const provider = props.provider;
  const summary = getProviderSummary(provider);
  const statusKey: ProviderStatusKey =
    (provider?.status as ProviderStatusKey | undefined) ?? "warning";
  const action = actionCopy(provider);
  const ActionIcon = action.icon;
  const modes = provider?.runtimeCapabilities?.executionModes
    .map((mode) => getRuntimeModeOption(mode)?.label)
    .filter((label): label is string => Boolean(label));
  const runtimeCapabilities = provider?.runtimeCapabilities;

  return (
    <section
      className="grid gap-3 rounded-lg border border-border/70 bg-muted/10 p-3"
      aria-label="Runtime status"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="grid min-w-0 gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-foreground">Runtime status</span>
            <Badge
              variant={
                statusKey === "ready" ? "success" : statusKey === "error" ? "error" : "warning"
              }
              size="sm"
            >
              {summary.headline}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">{summary.detail ?? ""}</p>
        </div>
        <Button
          type="button"
          size="xs"
          variant="outline"
          className="shrink-0"
          onClick={props.onRefresh}
          disabled={props.isRefreshing}
        >
          <RefreshCwIcon className={cn(props.isRefreshing && "animate-spin")} />
          {props.isRefreshing ? "Refreshing" : "Refresh status"}
        </Button>
      </div>

      <div className="grid gap-2 text-xs sm:grid-cols-2">
        <div className="grid gap-1">
          <span className="text-muted-foreground">Runtime instance</span>
          <code className="truncate text-foreground">{props.instanceId}</code>
        </div>
        <div className="grid gap-1">
          <span className="text-muted-foreground">Account</span>
          <span className="flex min-w-0 flex-wrap items-center gap-1 text-foreground">
            <span>{provider?.auth.label ?? provider?.auth.type ?? "Not reported"}</span>
            {provider?.auth.email ? (
              <>
                <span aria-hidden>·</span>
                <RedactedSensitiveText
                  value={provider.auth.email}
                  ariaLabel="Toggle account email visibility"
                  revealTooltip="Click to reveal email"
                  hideTooltip="Click to hide email"
                />
              </>
            ) : null}
          </span>
        </div>
        <div className="grid gap-1">
          <span className="text-muted-foreground">Models reported</span>
          <span className="text-foreground">{provider?.models.length ?? 0}</span>
        </div>
        <div className="grid gap-1">
          <span className="text-muted-foreground">Execution modes</span>
          <span className="text-foreground">
            {modes && modes.length > 0 ? modes.join(" · ") : "Not reported"}
          </span>
        </div>
      </div>

      {runtimeCapabilities ? (
        <div className="flex flex-wrap gap-1.5">
          {(
            [
              ["Resume", runtimeCapabilities.sessionResume],
              ["Cancel", runtimeCapabilities.turnCancellation],
              ["Rollback", runtimeCapabilities.conversationRollback],
            ] as const
          ).map(([label, capability]) => (
            <Badge key={label} variant={capabilityVariant(capability)} size="sm">
              {label}: {capabilityLabel(capability)}
            </Badge>
          ))}
        </div>
      ) : null}

      <div className={cn("flex items-start gap-2 rounded-md border px-2.5 py-2", action.tone)}>
        <ActionIcon className="mt-0.5 size-3.5 shrink-0" />
        <div className="grid min-w-0 gap-0.5">
          <span className="text-xs font-medium">{action.title}</span>
          <span className="text-xs opacity-90">{action.detail}</span>
        </div>
      </div>
    </section>
  );
}
