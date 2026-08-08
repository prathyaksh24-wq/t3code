import { memo } from "react";
import type { ProviderApprovalDecision } from "@t3tools/contracts";

import { type PendingApproval } from "../../session-logic";
import { ComposerPendingApprovalActions } from "./ComposerPendingApprovalActions";
import { ComposerPendingApprovalPanel } from "./ComposerPendingApprovalPanel";

interface ComposerPendingApprovalQueueProps {
  approvals: ReadonlyArray<PendingApproval>;
  respondingRequestIds: ReadonlyArray<string>;
  onRespondToApproval: (
    requestId: PendingApproval["requestId"],
    decision: ProviderApprovalDecision,
  ) => Promise<unknown>;
}

/** Keeps every pending request actionable when multiple providers pause together. */
export const ComposerPendingApprovalQueue = memo(function ComposerPendingApprovalQueue({
  approvals,
  respondingRequestIds,
  onRespondToApproval,
}: ComposerPendingApprovalQueueProps) {
  return (
    <div className="max-h-[min(48vh,30rem)] overflow-y-auto">
      {approvals.map((approval, index) => (
        <div
          key={approval.requestId}
          className="border-b border-border/65 last:border-b-0"
          data-pending-approval-request-id={approval.requestId}
        >
          <ComposerPendingApprovalPanel
            approval={approval}
            pendingCount={approvals.length}
            pendingIndex={index + 1}
          />
          <div className="flex flex-wrap items-center justify-end gap-2 px-4 pb-3 sm:px-5">
            <ComposerPendingApprovalActions
              requestId={approval.requestId}
              isResponding={respondingRequestIds.includes(approval.requestId)}
              onRespondToApproval={onRespondToApproval}
            />
          </div>
        </div>
      ))}
    </div>
  );
});
