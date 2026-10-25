"use client";

import { Component, type ReactNode } from "react";
import { StateView } from "@/components/StateView";
import { errorCopy } from "@/app/_lib/errors";

// A failed live query throws during render; this shows the error state with a retry instead of a
// blank page. Retrying reloads, because Convex keeps a failed subscription's error until then.
export class QueryBoundary extends Component<{ children: ReactNode; title?: string }, { error: unknown }> {
  state = { error: null as unknown };

  static getDerivedStateFromError(error: unknown) {
    return { error };
  }

  render() {
    if (this.state.error !== null) {
      return (
        <div className="mx-auto flex min-h-dvh max-w-120 items-center px-4">
          <StateView
            kind="error"
            title={this.props.title ?? "We couldn't load this"}
            body={errorCopy(this.state.error)}
            onAction={() => window.location.reload()}
          />
        </div>
      );
    }
    return this.props.children;
  }
}
