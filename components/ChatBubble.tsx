import type { ReactNode } from "react";
import { cx } from "./cx";

// Ported for completeness; unused, because Melos has no chat (CLAUDE.md §2, §4).
export function ChatBubble({ from = "them", name, time, children }: { from?: "me" | "them" | "system"; name?: string; time?: string; children: ReactNode }) {
  return (
    <div
      className={cx(
        "max-w-[80%] rounded-md px-3.5 py-2.5 text-body wrap-anywhere",
        from === "them" && "self-start rounded-bl-[0.375rem] bg-surface-raised text-ink",
        from === "me" && "self-end rounded-br-[0.375rem] bg-surface-brand text-ink",
        from === "system" && "max-w-[90%] self-center bg-transparent text-center text-small text-ink-muted",
      )}
    >
      {from === "them" && name ? <span className="sr-only">{name}: </span> : null}
      {children}
      {time ? <span className="mt-0.5 block text-[0.75rem] text-ink-muted">{time}</span> : null}
    </div>
  );
}
