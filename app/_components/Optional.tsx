"use client";

import { Component, type ReactNode } from "react";

// For a part of a screen whose query may not be deployed yet, or may fail on its own: shows
// `fallback` (nothing by default) instead of taking down the whole screen.
export class Optional extends Component<{ children: ReactNode; fallback?: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    return this.state.failed ? (this.props.fallback ?? null) : this.props.children;
  }
}
