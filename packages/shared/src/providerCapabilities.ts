import type { ServerProviderCapabilityState } from "@t3tools/contracts";

export function isProviderCapabilityInvokable(
  capability: { readonly state?: ServerProviderCapabilityState | undefined },
  fallbackEnabled = true,
): boolean {
  return fallbackEnabled && (capability.state?.status ?? "enabled") === "enabled";
}
