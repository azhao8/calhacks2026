"use client";

import { Button } from "@/components/Button";

// An inline confirmation for actions that change a plan. Both choices are the same size, and
// neither is worded to make the student feel bad.
export function Confirm({
  question,
  detail,
  yes,
  no,
  onYes,
  onNo,
  busy,
  disabled,
}: {
  question: string;
  detail?: string;
  yes: string;
  no: string;
  onYes: () => void;
  onNo: () => void;
  busy?: boolean;
  disabled?: boolean;
}) {
  return (
    <div role="group" aria-label={question} className="flex flex-col gap-3 rounded-sm bg-surface-raised p-4">
      <p className="text-body-strong">{question}</p>
      {detail ? <p className="text-small text-ink-muted">{detail}</p> : null}
      <div className="grid grid-cols-2 gap-3">
        <Button variant="secondary" block onClick={onYes} loading={busy} disabled={disabled}>
          {yes}
        </Button>
        <Button variant="secondary" block onClick={onNo} disabled={busy}>
          {no}
        </Button>
      </div>
    </div>
  );
}
