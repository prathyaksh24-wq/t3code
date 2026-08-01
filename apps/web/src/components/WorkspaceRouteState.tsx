import { SidebarInset } from "./ui/sidebar";

export function WorkspaceRouteLoading({
  label = "Loading workspace",
}: {
  readonly label?: string;
}) {
  return (
    <SidebarInset className="h-svh min-h-0 overflow-hidden overscroll-y-none bg-background text-foreground md:h-dvh">
      <div
        aria-live="polite"
        className="flex min-h-0 flex-1 items-center justify-center text-sm text-muted-foreground"
        role="status"
      >
        {label}
      </div>
    </SidebarInset>
  );
}
